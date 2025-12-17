
// scripts/harvest_overpass.js
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { CATEGORIES, COUNTRIES, USER_AGENT } from "./config_harvest.js";

// Overpass API URL
const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchOverpass(query) {
  const body = `[out:json][timeout:60];${query}`;
  console.log("  Asking Overpass...");

  try {
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      body,
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.log("  ⚠️ Rate limited. Waiting 30s...");
        await sleep(30000);
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

// Convert Overpass Element to GeoJSON Point
function toGeoJSON(element, categoryKey, categoryTags) {
  let lat, lon;

  if (element.type === 'node') {
    lat = element.lat;
    lon = element.lon;
  } else if (element.center) {
    // For ways/relations with 'out center;'
    lat = element.center.lat;
    lon = element.center.lon;
  } else {
    return null; // Should not happen with out center
  }

  const p = element.tags || {};

  // Clean tags
  const tags = new Set([...categoryTags]);
  if (p.cuisine) p.cuisine.split(';').forEach(t => tags.add(t.trim()));

  const name = p.name || p["name:en"] || p["name:es"] || "Unnamed";

  return {
    type: "Feature",
    id: `osm_${element.type}_${element.id}`,
    geometry: {
      type: "Point",
      coordinates: [lon, lat]
    },
    properties: {
      name,
      category: categoryKey,
      tags: [...tags].filter(t => t && t.length > 2),
      osm_id: `${element.type}/${element.id}`,
      ...Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("name")))
    }
  };
}

async function run() {
  console.log("🚜 Starting Optimized Harvest (Points Only)...");
  const outDir = join(Deno.cwd(), "seeds/europe");
  await ensureDir(outDir);

  for (const [country, regions] of Object.entries(COUNTRIES)) {
    console.log(`\n🌍 Country: ${country.toUpperCase()}`);

    for (const region of regions) {
      console.log(`\n📍 Region: ${region.name} (${region.areaId})`);

      for (const [catKey, catConfig] of Object.entries(CATEGORIES)) {
        console.log(`  👉 Category: ${catKey}`);

        const filename = `${catKey}-${country}-${region.name.toLowerCase().replace(/_/g, '-')}.yaml`;
        const filepath = join(outDir, filename);

        // Construct Query:
        const lines = catConfig.query.split(';').map(l => l.trim()).filter(l => l);
        let parts;

        // Handle test case where areaId is 0 (direct query) vs area filtering
        if (region.areaId === 0) {
             parts = lines.map(line => `${line};`).join('\n');
        } else {
             parts = lines.map(line => `${line}(area:${region.areaId});`).join('\n');
        }

        const fullQuery = `
          (${parts});
          out center;
        `;

        const data = await fetchOverpass(fullQuery);

        if (!data || !data.elements || data.elements.length === 0) {
          console.log("  ⚠️ No results.");
          await sleep(1000);
          continue;
        }

        console.log(`  ✅ Got ${data.elements.length} raw elements.`);

        const features = data.elements
          .map(e => toGeoJSON(e, catKey, catConfig.tags))
          .filter(f => f !== null);

        console.log(`  💾 Saving ${features.length} points to ${filename}...`);

        const yamlContent = stringify(features);
        await Deno.writeTextFile(filepath, yamlContent);

        await sleep(2000);
      }
    }
  }

  console.log("\n✨ Harvest Complete!");
}

run();
