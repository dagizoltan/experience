import { createContainer } from "../src/core/container.js";
import { createKv } from "../src/adapters/kv/index.js";
import { createIds } from "../src/core/ports/ids.js";
import { createClock } from "../src/core/ports/clock.js";
import { createPlaceRepository } from "../src/contexts/discovery/repository.js";
import { mapToCategoryAndTags, getAreaId, fetchSubRegions, sleep, OVERPASS_API_URL } from "./harvest_utils.js";

// === CONFIGURATION ===
const CONFIG = {
  countries: ["Portugal", "Spain", "France"],
  // Categories mapped to Overpass queries
  // We use nwr (Node, Way, Relation) to capture parks/beaches defined as polygons.
  // We use 'center' in the output to get a single lat/lon for Ways/Relations.
  categories: {
    culture: `
      nwr["tourism"="museum"](area.searchArea);
      nwr["historic"="castle"](area.searchArea);
      nwr["tourism"="attraction"](area.searchArea);
    `,
    gastronomy: `
      nwr["amenity"="restaurant"]["cuisine"~"regional|local|spanish|italian|french|portuguese|mediterranean"](area.searchArea);
    `,
    nature: `
      nwr["natural"="beach"](area.searchArea);
      nwr["natural"="peak"](area.searchArea);
      nwr["leisure"="park"](area.searchArea);
    `,
    family: `
      nwr["tourism"="theme_park"](area.searchArea);
      nwr["tourism"="zoo"](area.searchArea);
      nwr["leisure"="water_park"](area.searchArea);
    `,
    wellness: `
      nwr["amenity"="spa"](area.searchArea);
      nwr["leisure"="sauna"](area.searchArea);
    `
  }
};

// Limit items per sub-region category request to avoid memory issues/timeouts
const QUERY_LIMIT = 500;

const run = async () => {
  console.log("🌱 Seeding Application with Europe Data (Live Harvest)...");

  // 1. Setup DI & Repository
  const container = createContainer();
  const kv = await createKv();

  container.register('kv', () => kv, 'singleton');
  container.register('ids', createIds, 'singleton');
  container.register('clock', createClock, 'singleton');
  container.register('discovery.repository', createPlaceRepository, 'singleton');

  const repo = container.resolve('discovery.repository');

  // 2. Clear DB
  console.log("🧹 Clearing database...");
  await repo.removeAll();

  // 3. Harvest & Seed Loop
  for (const country of CONFIG.countries) {
    console.log(`\n=========================================`);
    console.log(`🚀 PROCESSING COUNTRY: ${country}`);
    console.log(`=========================================`);

    try {
      // A. Get Sub-regions
      let subRegions = await fetchSubRegions(country);
      if (subRegions.length === 0) {
        console.log(`⚠️ No sub-regions found for ${country}. Using country as single region.`);
        subRegions = [country];
      } else {
        console.log(`📋 Found ${subRegions.length} sub-regions.`);
      }

      // B. Process Regions
      for (const region of subRegions) {
        console.log(`\n🔹 Region: ${region}`);

        const regionAreaId = await getAreaId(region);
        if (!regionAreaId) {
          console.warn(`❌ Skipping ${region} (Area ID not found)`);
          continue;
        }

        // C. Process Categories
        for (const [catName, queryPart] of Object.entries(CONFIG.categories)) {
          process.stdout.write(`   🔸 ${catName}: `); // Inline status

          try {
            const features = await fetchOverpassData(regionAreaId, queryPart);

            if (features.length > 0) {
              await repo.saveAll(features);
              console.log(`✅ Seeded ${features.length} items.`);
            } else {
              console.log(`⚠️ No items found.`);
            }

          } catch (e) {
            console.log(`❌ Failed: ${e.message}`);
          }

          await sleep(1500); // Politeness delay
        }

        await sleep(1000); // Region delay
      }

    } catch (err) {
      console.error(`❌ Critical failure for ${country}:`, err);
    }
  }

  console.log(`\n✅ Seeding Complete!`);
};

// Executes the Overpass Query
async function fetchOverpassData(areaId, queryBody) {
  const query = `
    [out:json][timeout:90];
    area(${areaId})->.searchArea;
    (
      ${queryBody}
    );
    out center body ${QUERY_LIMIT};
    >;
    out skel qt;
  `;

  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const data = await response.json();
  // Filter for elements that have tags and a name
  // 'center' is available for ways/relations if 'out center' is used.
  const elements = data.elements.filter(e =>
    (e.type === 'node' || e.center) && e.tags && e.tags.name
  );

  return elements.map(el => {
    const { category, tags } = mapToCategoryAndTags(el.tags);

    // Geometry: Use 'lat/lon' for nodes, or 'center.lat/center.lon' for ways/relations
    const lat = el.lat || el.center.lat;
    const lon = el.lon || el.center.lon;

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        name: el.tags.name,
        category: category,
        tags: tags
      }
    };
  });
}

run();
