import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { mapToCategoryAndTags, getAreaId, fetchSubRegions, sleep, OVERPASS_API_URL } from "./harvest_utils.js";

// === CONFIGURATION ===
const CONFIG = {
  countries: ["Portugal", "Spain", "France"],

  categories: {
    history: `
      nwr["historic"~"castle|ruins|archaeological_site|battlefield|monument|memorial"](area.searchArea);
    `,
    art: `
      nwr["tourism"~"museum|gallery"](area.searchArea);
      nwr["amenity"="arts_centre"](area.searchArea);
    `,
    religious: `
      nwr["historic"~"church|monastery"](area.searchArea);
      nwr["amenity"="place_of_worship"]["religion"~"christian|muslim|jewish"](area.searchArea);
    `,
    gastronomy: `
      nwr["amenity"="restaurant"]["cuisine"~"regional|local|spanish|italian|french|portuguese|mediterranean|seafood|tapas"](area.searchArea);
      nwr["craft"="winery"](area.searchArea);
      nwr["shop"="wine"](area.searchArea);
    `,
    nature: `
      nwr["natural"~"beach|peak|volcano|cave_entrance|cliff"](area.searchArea);
      nwr["leisure"~"park|nature_reserve"](area.searchArea);
      nwr["boundary"="national_park"](area.searchArea);
    `,
    family: `
      nwr["tourism"~"theme_park|zoo|aquarium"](area.searchArea);
      nwr["leisure"="water_park"](area.searchArea);
    `,
    wellness: `
      nwr["amenity"~"spa|public_bath"](area.searchArea);
      nwr["leisure"="sauna"](area.searchArea);
    `
  }
};

const QUERY_LIMIT = 2000;

// Helper to write to stdout in Deno
async function print(msg) {
  await Deno.stdout.write(new TextEncoder().encode(msg));
}

const run = async () => {
  console.log("🚜 Starting Europe Harvest (API -> YAML)...");

  // Ensure output directory
  await ensureDir("seeds/europe");

  for (const country of CONFIG.countries) {
    console.log(`\n=========================================`);
    console.log(`🚀 HARVESTING: ${country}`);
    console.log(`=========================================`);

    const countryFeatures = [];

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

        let regionTotal = 0;

        // C. Process Categories
        for (const [catName, queryPart] of Object.entries(CONFIG.categories)) {
          await print(`   🔸 ${catName}: `);

          try {
            const features = await fetchOverpassData(regionAreaId, queryPart);

            if (features.length > 0) {
              countryFeatures.push(...features);
              await print(`✅ ${features.length} items.\n`);
              regionTotal += features.length;
            } else {
              await print(`⚠️ 0 items.\n`);
            }

          } catch (e) {
            await print(`❌ Failed: ${e.message}\n`);
          }

          await sleep(2000);
        }

        await sleep(1000);
      }

      // D. Save to YAML
      if (countryFeatures.length > 0) {
        const uniqueFeatures = deduplicate(countryFeatures);
        const outputPath = `seeds/europe/${country.toLowerCase().replace(/\s/g, '_')}.yaml`;

        console.log(`\n💾 Saving ${uniqueFeatures.length} unique items to ${outputPath}...`);
        await Deno.writeTextFile(outputPath, stringify(uniqueFeatures));
      } else {
        console.warn(`⚠️ No data found for ${country}.`);
      }

    } catch (err) {
      console.error(`❌ Critical failure for ${country}:`, err);
    }
  }

  console.log(`\n✅ Harvesting Complete!`);
};

// Executes the Overpass Query
async function fetchOverpassData(areaId, queryBody) {
  const query = `
    [out:json][timeout:120];
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

  const elements = data.elements.filter(e =>
    (e.type === 'node' || e.center) && e.tags && e.tags.name
  );

  return elements.map(el => {
    const { category, tags } = mapToCategoryAndTags(el.tags);

    const lat = el.lat || (el.center ? el.center.lat : null);
    const lon = el.lon || (el.center ? el.center.lon : null);

    if (lat === null || lon === null) return null;

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
  }).filter(Boolean);
}

function deduplicate(features) {
  const seen = new Set();
  return features.filter(f => {
    const key = `${f.properties.name}-${f.geometry.coordinates.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

run();
