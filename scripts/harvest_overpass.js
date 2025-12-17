
// scripts/harvest_overpass.js
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { CATEGORIES, COUNTRIES, USER_AGENT } from "./config_harvest.js";

// Overpass API URL
const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const OVERPASS_STATUS = "https://overpass-api.de/api/status";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForSlot() {
    try {
        const res = await fetch(OVERPASS_STATUS, {
             headers: { "User-Agent": USER_AGENT }
        });
        if (!res.ok) return; // Ignore errors, just proceed

        const text = await res.text();

        // Check for available slots
        // Format: "X slots available now."
        if (text.includes("slots available now")) {
            // We have slots, but let's see how many.
            // If it says "0 slots available now" (unlikely, usually phrasing changes), we wait.
            // Actually, if we are blocked, it usually says:
            // "Slot available after: 2024-..."
            return;
        }

        // Check for wait time
        const match = text.match(/Slot available after: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
        if (match) {
            const availableTime = new Date(match[1]).getTime();
            const now = Date.now();
            const waitTime = availableTime - now;

            if (waitTime > 0) {
                console.log(`  ⏳ No slots. Waiting ${Math.ceil(waitTime/1000)}s for next slot...`);
                // Add a buffer of 2 seconds
                await sleep(waitTime + 2000);
            }
        }
    } catch (e) {
        console.warn("  ⚠️ Failed to check Overpass status:", e.message);
    }
}

async function fetchOverpass(query, retries = 3) {
  // Respect limits before asking
  await waitForSlot();

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

      const txt = await res.text();
      console.error(`  Overpass Error: ${res.status} ${res.statusText}`, txt.slice(0, 200));
      throw new Error(`Overpass Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.remark) {
        console.log("  ⚠️ Overpass Remark:", data.remark);
    }
    return data;
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
  console.log("🚜 Starting Optimized Harvest (Spain Gastronomy Focus)...");
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

        // Normalize config to array of queries
        const queryList = catConfig.queries || [catConfig.query];
        let allElements = [];

        for (const q of queryList) {
            // Construct Query:
            const lines = q.split(';').map(l => l.trim()).filter(l => l);
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

            console.log(`  Requesting chunk: ${q.substring(0, 50)}...`);
            const data = await fetchOverpass(fullQuery);

            if (data && data.elements) {
                console.log(`  ✅ Chunk got ${data.elements.length} raw elements.`);
                allElements = allElements.concat(data.elements);
            } else {
                console.log("  ⚠️ Chunk returned no data or failed.");
            }

            // Increased sleep between chunks to 5s to be polite and avoid 429
            await sleep(5000);
        }

        if (allElements.length === 0) {
             console.log("  ⚠️ No results for any chunk.");
             await sleep(2000);
             continue;
        }

        // Deduplicate elements by ID
        const uniqueElements = new Map();
        for (const el of allElements) {
            const key = `${el.type}/${el.id}`;
            if (!uniqueElements.has(key)) {
                uniqueElements.set(key, el);
            }
        }
        console.log(`  Total unique elements: ${uniqueElements.size}`);

        const features = Array.from(uniqueElements.values())
          .map(e => toGeoJSON(e, catKey, catConfig.tags))
          .filter(f => f !== null);

        console.log(`  💾 Saving ${features.length} points to ${filename}...`);

        const yamlContent = stringify(features);
        await Deno.writeTextFile(filepath, yamlContent);

        // Increased sleep between regions to 10s
        await sleep(10000);
      }
    }
  }

  console.log("\n✨ Harvest Complete!");
}

run();
