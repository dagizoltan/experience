// scripts/harvest_overpass.js
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { CATEGORIES, COUNTRIES, USER_AGENT } from "./config_harvest.js";

// Overpass API URL
const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Retry logic with exponential backoff
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      const backoff = delay * Math.pow(2, i);
      console.log(`  ⚠️ Request failed. Retry ${i + 1}/${retries} after ${backoff}ms`);
      await sleep(backoff);
    }
  }
};

// Checkpoint helpers
const CHECKPOINT_FILE = './harvest-checkpoint.json';

const saveCheckpoint = async (state) => {
  await Deno.writeTextFile(
    CHECKPOINT_FILE,
    JSON.stringify(state, null, 2)
  );
};

const loadCheckpoint = async () => {
  try {
    const data = await Deno.readTextFile(CHECKPOINT_FILE);
    return JSON.parse(data);
  } catch {
    return null;
  }
};

async function fetchOverpass(query) {
  // Increased timeout to 180s (3 mins) to avoid 504 on large provinces
  const body = `[out:json][timeout:180];${query}`;
  console.log("  Asking Overpass...");

  const res = await fetch(OVERPASS_API, {
    method: "POST",
    body,
    headers: { "User-Agent": USER_AGENT }
  });

  if (!res.ok) {
    if (res.status === 429) {
      console.log("  ⚠️ Rate limited (429). Waiting 60s...");
      await sleep(60000);
      throw new Error("Rate limited");
    }
    if (res.status === 504) {
      throw new Error(`Gateway Timeout (504)`);
    }
    throw new Error(`Overpass Error: ${res.status} ${res.statusText}`);
  }

  return await res.json();
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
  console.log("🚜 Starting Optimized Harvest (Spain Gastronomy Focus)...");
  const outDir = join(Deno.cwd(), "seeds/europe");
  await ensureDir(outDir);

  // Load checkpoint
  let checkpoint = await loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      countryIndex: 0,
      regionIndex: 0,
      categoryIndex: 0
    };
  } else {
    console.log("  🔄 Resuming from checkpoint:", checkpoint);
  }

  const countries = Object.entries(COUNTRIES);

  for (let i = checkpoint.countryIndex; i < countries.length; i++) {
    const [country, regions] = countries[i];
    console.log(`\n🌍 Country: ${country.toUpperCase()}`);

    for (let j = (i === checkpoint.countryIndex ? checkpoint.regionIndex : 0); j < regions.length; j++) {
      const region = regions[j];
      console.log(`\n📍 Region: ${region.name} (${region.areaId})`);

      const categories = Object.entries(CATEGORIES);
      for (let k = (i === checkpoint.countryIndex && j === checkpoint.regionIndex ? checkpoint.categoryIndex : 0); k < categories.length; k++) {
        const [catKey, catConfig] = categories[k];
        console.log(`  👉 Category: ${catKey}`);

        const filename = `${catKey}-${country}-${region.name.toLowerCase().replace(/_/g, '-')}.yaml`;
        const filepath = join(outDir, filename);

        // Construct Query
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

        try {
          const data = await retryWithBackoff(() => fetchOverpass(fullQuery), 3, 5000);

          if (!data || !data.elements || data.elements.length === 0) {
            console.log("  ⚠️ No results.");
          } else {
            console.log(`  ✅ Got ${data.elements.length} raw elements.`);

            const features = data.elements
              .map(e => toGeoJSON(e, catKey, catConfig.tags))
              .filter(f => f !== null);

            console.log(`  💾 Saving ${features.length} points to ${filename}...`);

            const yamlContent = stringify(features);
            await Deno.writeTextFile(filepath, yamlContent);
          }

          // Update checkpoint
          await saveCheckpoint({
            countryIndex: i,
            regionIndex: j,
            categoryIndex: k + 1
          });

          // Increased sleep to 5s to play nice
          await sleep(5000);
        } catch (err) {
          console.error(`  ❌ Failed to process ${catKey} for ${region.name}:`, err);
          // Optional: decide whether to abort or skip
        }
      }

      // Reset category index for next region
      if (i === checkpoint.countryIndex && j === checkpoint.regionIndex) {
          checkpoint.categoryIndex = 0;
      }
    }
  }

  // Clear checkpoint on success
  try {
    await Deno.remove(CHECKPOINT_FILE);
  } catch {}

  console.log("\n✨ Harvest Complete!");
}

run();
