
// scripts/harvest_overpass.js
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { CATEGORIES, COUNTRIES, USER_AGENT } from "./config_harvest.js";

// Overpass API URL
const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const REPORT_FILE = "harvest_report.json";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- Report Management ---
async function loadReport() {
    try {
        const text = await Deno.readTextFile(REPORT_FILE);
        return JSON.parse(text);
    } catch {
        return {}; // Start fresh if no report
    }
}

async function saveReport(report) {
    await Deno.writeTextFile(REPORT_FILE, JSON.stringify(report, null, 2));
}

function getReportKey(country, regionName, categoryKey) {
    return `${country}:${regionName}:${categoryKey}`;
}

// --- Overpass Fetcher ---
async function fetchOverpass(query) {
  // Use a long timeout (900s) to give the server a chance
  const body = `[out:json][timeout:900];${query}`;
  console.log("  Asking Overpass...");

  try {
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      body,
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      const txt = await res.text();
      // We do NOT retry loop here. We just throw error so the main loop can skip.
      throw new Error(`${res.status} ${res.statusText}: ${txt.slice(0, 100)}`);
    }

    return await res.json();
  } catch (err) {
    throw err; // Propagate up
  }
}

// Convert Overpass Element to GeoJSON Point
function toGeoJSON(element, categoryKey, categoryTags) {
  let lat, lon;

  if (element.type === 'node') {
    lat = element.lat;
    lon = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lon = element.center.lon;
  } else {
    return null;
  }

  const p = element.tags || {};
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

async function processItem(country, region, catKey, catConfig, report) {
    const key = getReportKey(country, region.name, catKey);

    // Skip if already successful
    if (report[key] === "success") {
        console.log(`  ⏭️  Skipping ${key} (Already Done)`);
        return;
    }

    console.log(`  👉 Category: ${catKey}`);
    const outDir = join(Deno.cwd(), "seeds/europe");
    await ensureDir(outDir);
    const filename = `${catKey}-${country}-${region.name.toLowerCase().replace(/_/g, '-')}.yaml`;
    const filepath = join(outDir, filename);

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
        const data = await fetchOverpass(fullQuery);

        if (!data || !data.elements) {
            console.log("  ⚠️ No data returned (empty).");
             // Treat empty as success (we queried, got nothing)
            report[key] = "success";
        } else {
            console.log(`  ✅ Got ${data.elements.length} raw elements.`);
            const features = data.elements
                .map(e => toGeoJSON(e, catKey, catConfig.tags))
                .filter(f => f !== null);

            console.log(`  💾 Saving ${features.length} points to ${filename}...`);
            const yamlContent = stringify(features);
            await Deno.writeTextFile(filepath, yamlContent);

            report[key] = "success";
        }

        await saveReport(report);
        // Success sleep: Be polite but moving forward
        await sleep(5000);

    } catch (err) {
        console.error(`  ❌ Failed ${key}:`, err.message);
        report[key] = "failed";
        await saveReport(report);
        // Error sleep: Wait a bit before next request to avoid hammering
        await sleep(5000);
    }
}

async function run() {
  console.log("🚜 Starting Resilient Harvest...");
  const report = await loadReport();

  // Phase 1: Main Loop
  for (const [country, regions] of Object.entries(COUNTRIES)) {
    console.log(`\n🌍 Country: ${country.toUpperCase()}`);
    for (const region of regions) {
      console.log(`\n📍 Region: ${region.name} (${region.areaId})`);
      for (const [catKey, catConfig] of Object.entries(CATEGORIES)) {
         await processItem(country, region, catKey, catConfig, report);
      }
    }
  }

  // Phase 2: Retry Failed
  console.log("\n🔄 Starting Retry Phase for Failed Items...");
  let retryCount = 0;

  // Re-read report to be safe or just use current state
  // Iterate again (simplest way to preserve order)
  for (const [country, regions] of Object.entries(COUNTRIES)) {
    for (const region of regions) {
      for (const [catKey, catConfig] of Object.entries(CATEGORIES)) {
         const key = getReportKey(country, region.name, catKey);
         if (report[key] === "failed") {
             console.log(`\n🔄 Retrying: ${key}`);
             await processItem(country, region, catKey, catConfig, report);
             retryCount++;
         }
      }
    }
  }

  if (retryCount === 0) {
      console.log("  No failed items to retry.");
  }

  console.log("\n✨ Harvest Complete!");
}

run();
