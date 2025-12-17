
// scripts/harvest_overpass.js
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { CATEGORIES, REGIONS, USER_AGENT } from "./config_harvest.js";
import osmtogeojson from "npm:osmtogeojson";

// Overpass API URL
const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchOverpass(query) {
  const body = `[out:json][timeout:25];${query}`;
  console.log("  Asking Overpass...");

  try {
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      body,
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.log("  ⚠️ Rate limited. Waiting 10s...");
        await sleep(10000);
        return fetchOverpass(query);
      }
      throw new Error(`Overpass Error: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.error("  ❌ Request failed:", err.message);
    return null;
  }
}

function mapFeature(feature, categoryKey, categoryTags) {
  const p = feature.properties || {};

  const tags = new Set([...categoryTags]);
  if (p.cuisine) p.cuisine.split(';').forEach(t => tags.add(t.trim()));

  const name = p.name || p["name:en"] || "Unnamed";

  return {
    type: "Feature",
    id: `osm_${feature.id}`,
    geometry: feature.geometry,
    properties: {
      name,
      category: categoryKey,
      tags: [...tags].filter(t => t && t.length > 2),
      osm_id: feature.id,
      ...Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("name")))
    }
  };
}

async function run() {
  console.log("🚜 Starting European Harvest...");
  const outDir = join(Deno.cwd(), "seeds/europe");
  await ensureDir(outDir);

  for (const region of REGIONS) {
    console.log(`\n📍 Region: ${region.name}`);

    for (const [catKey, catConfig] of Object.entries(CATEGORIES)) {
      console.log(`  👉 Category: ${catKey}`);

      // Use query directly if it has (around) or (area) in it
      // Otherwise append area filter if areaId > 0
      let fullQueryParts = catConfig.query.split(';').map(l => l.trim()).filter(l => l);

      if (region.areaId > 0) {
         fullQueryParts = fullQueryParts.map(line => `${line}(area:${region.areaId});`);
      } else {
         fullQueryParts = fullQueryParts.map(line => `${line};`);
      }

      const fullQuery = `
        (${fullQueryParts.join('\n')});
        out body;
        >;
        out skel qt;
      `;

      const data = await fetchOverpass(fullQuery);

      if (!data || !data.elements || data.elements.length === 0) {
        console.log("  ⚠️ No results.");
        continue;
      }

      console.log(`  ✅ Got ${data.elements.length} raw elements.`);

      const geojson = osmtogeojson(data);
      const features = geojson.features.map(f => mapFeature(f, catKey, catConfig.tags));
      const validFeatures = features.filter(f => f.geometry);

      console.log(`  💾 Saving ${validFeatures.length} features...`);

      const yamlContent = stringify(validFeatures);
      const filename = `${region.name}_${catKey}.yaml`;
      await Deno.writeTextFile(join(outDir, filename), yamlContent);

      await sleep(1000);
    }
  }

  console.log("\n✨ Harvest Complete!");
}

run();
