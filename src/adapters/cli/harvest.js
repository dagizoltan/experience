
// src/adapters/cli/harvest.js
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { CATEGORIES, COUNTRIES, USER_AGENT } from "./harvest_config.js";

// Overpass API URL
const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchOverpass(query, retries = 3) {
  // Increased timeout to 180s (3 mins) to avoid 504 on large provinces
  const body = `[out:json][timeout:180];${query}`;
  console.log("  Asking Overpass...");

  try {
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      body,
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.log("  ⚠️ Rate limited (429). Waiting 60s...");
        await sleep(60000);
        return fetchOverpass(query, retries);
      }
      if (res.status === 504) {
        if (retries > 0) {
           console.log(`  ⚠️ Gateway Timeout (504). Retrying in 60s... (${retries} left)`);
           await sleep(60000);
           return fetchOverpass(query, retries - 1);
        } else {
           console.error("  ❌ Gateway Timeout (504). No retries left.");
           return null;
        }
      }
      throw new Error(`Overpass Error: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.error("  ❌ Request failed:", err.message);
    if (retries > 0) {
       console.log(`  Retrying network error in 30s... (${retries} left)`);
       await sleep(30000);
       return fetchOverpass(query, retries - 1);
    }
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
  console.log("🚜 Starting Optimized Harvest (Spain Multicategory)...");
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

        // Optional: Skip if already exists to resume?
        // const exists = await Deno.stat(filepath).then(() => true).catch(() => false);
        // if (exists) { console.log("    Skipping (already exists)"); continue; }

        // Construct Query:
        const lines = catConfig.query.split(';').map(l => l.trim()).filter(l => l);
        let parts;

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
          await sleep(2000);
          continue;
        }

        console.log(`  ✅ Got ${data.elements.length} raw elements.`);

        const features = data.elements
          .map(e => toGeoJSON(e, catKey, catConfig.tags))
          .filter(f => f !== null);

        console.log(`  💾 Saving ${features.length} points to ${filename}...`);

        const yamlContent = stringify(features);
        await Deno.writeTextFile(filepath, yamlContent);

        // Increased sleep to 5s to play nice
        await sleep(5000);
      }
    }
  }

  console.log("\n✨ Harvest Complete!");
}

run();
