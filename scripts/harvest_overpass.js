
// scripts/harvest_overpass.js
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { CATEGORIES, COUNTRIES, USER_AGENT } from "./config_harvest.js";

// Overpass API URL
const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Dynamic Concurrency State
const STATE = {
  concurrency: 2, // Start conservative
  minConcurrency: 1,
  maxConcurrency: 6,
  paused: false,
  pauseUntil: 0,
};

async function waitIfPaused() {
  if (STATE.paused) {
    const now = Date.now();
    if (now < STATE.pauseUntil) {
      const waitTime = STATE.pauseUntil - now;
      // Only log if the wait is substantial
      if (waitTime > 2000) {
         // console.log(`  ⏸️  Global pause active. Waiting ${Math.ceil(waitTime/1000)}s...`);
      }
      await sleep(waitTime);
    }
    STATE.paused = false;
  }
}

function triggerPause(durationMs) {
  if (!STATE.paused) {
    STATE.paused = true;
    STATE.pauseUntil = Date.now() + durationMs;
    // Reduce concurrency on error
    STATE.concurrency = Math.max(STATE.minConcurrency, STATE.concurrency - 1);
    console.log(`  📉 Rate Limit hit! reducing concurrency to ${STATE.concurrency} and pausing for ${durationMs/1000}s.`);
  } else {
    // Extend pause if needed
    const newEnd = Date.now() + durationMs;
    if (newEnd > STATE.pauseUntil) STATE.pauseUntil = newEnd;
  }
}

function tryIncreaseConcurrency() {
  if (!STATE.paused && STATE.concurrency < STATE.maxConcurrency) {
    // 10% chance to increase concurrency on success
    if (Math.random() > 0.9) {
      STATE.concurrency++;
      console.log(`  📈 Scaling up: Concurrency increased to ${STATE.concurrency}`);
    }
  }
}

async function fetchOverpass(query, retries = 3) {
  await waitIfPaused();

  // Increased timeout to 180s (3 mins)
  const body = `[out:json][timeout:180];${query}`;
  // console.log("  Asking Overpass...");

  try {
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      body,
      headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) {
      if (res.status === 429) {
        triggerPause(60000); // 60s pause
        return fetchOverpass(query, retries);
      }
      if (res.status === 504) {
        if (retries > 0) {
           console.log(`  ⚠️ Gateway Timeout (504). Retrying in 60s... (${retries} left)`);
           triggerPause(60000); // Treat 504 like a rate limit signal to back off
           return fetchOverpass(query, retries - 1);
        } else {
           console.error("  ❌ Gateway Timeout (504). No retries left.");
           return null;
        }
      }
      throw new Error(`Overpass Error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    tryIncreaseConcurrency();
    return json;

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

async function processTask(task) {
  const { country, region, catKey, catConfig, outDir } = task;
  const filename = `${catKey}-${country}-${region.name.toLowerCase().replace(/_/g, '-')}.yaml`;
  const filepath = join(outDir, filename);

  console.log(`  Running: ${country}/${region.name} - ${catKey}`);

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
    // console.log(`  ⚠️ No results for ${region.name} ${catKey}.`);
    return;
  }

  const features = data.elements
    .map(e => toGeoJSON(e, catKey, catConfig.tags))
    .filter(f => f !== null);

  if (features.length > 0) {
      console.log(`  ✅ Saved ${features.length} items to ${filename}`);
      const yamlContent = stringify(features);
      await Deno.writeTextFile(filepath, yamlContent);
  }
}

async function run() {
  console.log("🚜 Starting Optimized Concurrent Harvest...");
  const outDir = join(Deno.cwd(), "seeds/europe");
  await ensureDir(outDir);

  // 1. Build Queue
  const queue = [];
  for (const [country, regions] of Object.entries(COUNTRIES)) {
    for (const region of regions) {
      for (const [catKey, catConfig] of Object.entries(CATEGORIES)) {
        queue.push({ country, region, catKey, catConfig, outDir });
      }
    }
  }

  console.log(`📋 Queued ${queue.length} tasks.`);

  // 2. Worker Loop
  let activeWorkers = 0;
  let taskIndex = 0;
  const promises = [];

  // We need a supervisor loop that keeps spawning workers up to concurrency limit
  // until all tasks are done.
  while (taskIndex < queue.length || activeWorkers > 0) {

    // Spawn new workers if slots available
    while (taskIndex < queue.length && activeWorkers < STATE.concurrency && !STATE.paused) {
        // Fire and forget (it manages its own completion)
        // But we need to track it.
        // Actually, the `startWorker` above processes *multiple* tasks.
        // Let's change strategy: spawn N workers that run until queue empty.
        // But `concurrency` changes dynamicallly.
        // So we need "micro-tasks".

        const task = queue[taskIndex++];
        activeWorkers++;

        // Non-blocking execution
        processTask(task)
            .catch(err => console.error(`Task Error: ${err}`))
            .finally(() => { activeWorkers--; });
    }

    // Wait loop
    await sleep(100);
  }

  console.log("\n✨ Harvest Complete!");
}

run();
