// scripts/harvest_manager.js
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { mapToCategoryAndTags, getAreaId, fetchSubRegions, sleep, OVERPASS_API_URL } from "./harvest_utils.js";

// CATEGORIES CONFIGURATION
// We split queries by category to reduce load and avoid timeouts.
const CATEGORY_QUERIES = {
  culture: `
    node["tourism"="museum"](area.searchArea);
    node["historic"="castle"](area.searchArea);
    node["tourism"="attraction"](area.searchArea);
  `,
  gastronomy: `
    node["amenity"="restaurant"]["cuisine"~"regional|local|spanish|italian|french|portuguese|mediterranean"](area.searchArea);
  `,
  nature: `
    node["natural"="beach"](area.searchArea);
    node["natural"="peak"](area.searchArea);
    node["leisure"="park"](area.searchArea);
  `,
  family: `
    node["tourism"="theme_park"](area.searchArea);
    node["tourism"="zoo"](area.searchArea);
    node["leisure"="water_park"](area.searchArea);
  `,
  wellness: `
    node["amenity"="spa"](area.searchArea);
    node["leisure"="sauna"](area.searchArea);
  `
};

// Orchestrates the harvest for a list of countries
async function harvestCountries(countries) {
  for (const country of countries) {
    console.log(`\n=========================================`);
    console.log(`🚀 STARTING HARVEST: ${country}`);
    console.log(`=========================================`);

    try {
      // 1. Get Sub-regions
      let subRegions = await fetchSubRegions(country);

      // Fallback: If no subregions found (e.g. small country like Andorra), use the country itself
      if (subRegions.length === 0) {
        console.log(`⚠️ No sub-regions found for ${country}. Harvesting as single region.`);
        subRegions = [country];
      } else {
        console.log(`📋 Found ${subRegions.length} sub-regions: ${subRegions.join(', ')}`);
      }

      const allCountryFeatures = [];

      // 2. Iterate Regions
      for (const region of subRegions) {
        console.log(`\n🔹 Processing Region: ${region}`);

        const regionAreaId = await getAreaId(region);
        if (!regionAreaId) {
          console.warn(`❌ Skipping ${region} (Area ID not found)`);
          continue;
        }

        // 3. Iterate Categories within Region
        for (const [catName, queryPart] of Object.entries(CATEGORY_QUERIES)) {
          console.log(`   🔸 Fetching ${catName}...`);

          try {
            const features = await fetchOverpassData(regionAreaId, queryPart);
            console.log(`      ✅ Got ${features.length} items.`);
            allCountryFeatures.push(...features);
          } catch (e) {
            console.error(`      ❌ Failed ${catName} in ${region}: ${e.message}`);
          }

          await sleep(2000); // Rate limiting between categories
        }

        await sleep(2000); // Rate limiting between regions
      }

      // 4. Save Country Data
      if (allCountryFeatures.length > 0) {
        const outputPath = `seeds/europe/${country.toLowerCase().replace(/\s/g, '_')}.yaml`;
        await ensureDir("seeds/europe");

        // Deduplicate by name + lat/lon (simple check)
        const uniqueFeatures = deduplicate(allCountryFeatures);

        console.log(`\n💾 Saving ${uniqueFeatures.length} total items for ${country} to ${outputPath}...`);
        await Deno.writeTextFile(outputPath, stringify(uniqueFeatures));
      } else {
        console.warn(`⚠️ No data collected for ${country}.`);
      }

    } catch (err) {
      console.error(`❌ Critical failure for ${country}:`, err);
    }
  }
}

// Executes the Overpass Query
async function fetchOverpassData(areaId, queryBody) {
  const query = `
    [out:json][timeout:90];
    area(${areaId})->.searchArea;
    (
      ${queryBody}
    );
    out body 300;
    >;
    out skel qt;
  `;
  // Limit 300 per category per sub-region -> High enough for quality, low enough for limits.

  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const data = await response.json();
  const nodes = data.elements.filter(e => e.type === 'node' && e.tags && e.tags.name);

  return nodes.map(node => {
    const { category, tags } = mapToCategoryAndTags(node.tags);
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [node.lon, node.lat]
      },
      properties: {
        name: node.tags.name,
        category: category,
        tags: tags
      }
    };
  });
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

// === RUN ===
const TARGET_COUNTRIES = [
  "Andorra", // Small test
  "Portugal",
  "Spain",
  "France"
];

if (import.meta.main) {
  await harvestCountries(TARGET_COUNTRIES);
}
