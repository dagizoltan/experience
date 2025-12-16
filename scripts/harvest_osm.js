import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

// Limit per query to avoid massive payloads during testing
// For production, you might want to paginate or increase this carefully.
const LIMIT = 500;

// Mapping Logic: OSM Tags -> App Categories/Tags
function mapToCategoryAndTags(osmTags) {
  let category = 'hidden_gems'; // default
  let tags = [];

  if (osmTags.tourism === 'museum' || osmTags.amenity === 'arts_centre') {
    category = 'culture';
    tags.push('museum', 'art');
  } else if (osmTags.historic === 'castle' || osmTags.historic === 'monument' || osmTags.tourism === 'attraction') {
    category = 'culture';
    tags.push('history', 'landmark');
  } else if (osmTags.amenity === 'restaurant' || osmTags.amenity === 'bar' || osmTags.amenity === 'cafe') {
    category = 'gastronomy';
    tags.push(osmTags.amenity);
    if (osmTags.cuisine) tags.push(osmTags.cuisine);
  } else if (osmTags.natural === 'beach' || osmTags.leisure === 'park' || osmTags.natural === 'peak') {
    category = 'nature';
    tags.push('nature', osmTags.natural || osmTags.leisure);
  } else if (osmTags.leisure === 'water_park' || osmTags.tourism === 'theme_park') {
    category = 'family';
    tags.push('fun', 'kids');
  } else if (osmTags.amenity === 'spa' || osmTags.leisure === 'sauna') {
    category = 'wellness';
    tags.push('relax', 'spa');
  } else if (osmTags.shop) {
    category = 'shopping';
    tags.push('shop');
  }

  // Deduplicate tags
  tags = [...new Set(tags)];
  return { category, tags };
}

async function getAreaId(placeName) {
  console.log(`🔍 Resolving area ID for "${placeName}"...`);
  const url = `${NOMINATIM_API_URL}?q=${encodeURIComponent(placeName)}&format=json&polygon_geojson=0&limit=1`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'JulesApp/1.0' } // Nominatim requires a UA
  });

  if (!response.ok) throw new Error(`Nominatim API Error: ${response.statusText}`);

  const data = await response.json();
  if (!data || data.length === 0) throw new Error(`Place "${placeName}" not found.`);

  const place = data[0];
  const osmId = place.osm_id;
  const osmType = place.osm_type;

  if (osmType !== 'relation') {
    // If it's not a relation (e.g. a node), we can't get an area ID easily.
    // However, usually countries/regions are relations.
    throw new Error(`Place is type ${osmType}, expected 'relation' for Area ID derivation.`);
  }

  // Area ID = Relation ID + 3600000000
  const areaId = parseInt(osmId) + 3600000000;
  console.log(`✅ Found Area ID: ${areaId} for ${placeName}`);
  return areaId;
}

export async function harvestRegion(regionName, outputPath) {
  try {
    const areaId = await getAreaId(regionName);

    console.log(`🌍 Harvesting OSM data for Area: ${areaId} (${regionName})...`);

    // Using area(id) to filter
    const query = `
      [out:json][timeout:60];
      area(${areaId})->.searchArea;
      (
        node["tourism"="museum"](area.searchArea);
        node["historic"="castle"](area.searchArea);
        node["natural"="beach"](area.searchArea);
        node["amenity"="restaurant"]["cuisine"~"regional|local|spanish|italian|french"](area.searchArea);
        node["leisure"="park"](area.searchArea);
      );
      out body ${LIMIT};
      >;
      out skel qt;
    `;

    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!response.ok) throw new Error(`Overpass API Error: ${response.statusText}`);

    const data = await response.json();
    const nodes = data.elements.filter(e => e.type === 'node' && e.tags && e.tags.name);

    console.log(`📦 Received ${nodes.length} raw items for ${regionName}.`);

    const features = nodes.map(node => {
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

    console.log(`✅ Processed ${features.length} valid features.`);

    await ensureDir(outputPath.substring(0, outputPath.lastIndexOf('/')));
    const yamlString = stringify(features);
    await Deno.writeTextFile(outputPath, yamlString);
    console.log(`💾 Saved to ${outputPath}`);

  } catch (error) {
    console.error(`❌ Error harvesting ${regionName}:`, error.message);
  }
}

// CLI Support: Allow running directly `deno run ... scripts/harvest_osm.js "Spain"`
if (import.meta.main) {
  const region = Deno.args[0];
  if (!region) {
    console.error("Please provide a region name.");
    Deno.exit(1);
  }
  const output = Deno.args[1] || `seeds/${region.toLowerCase().replace(/\s/g, '_')}.yaml`;
  await harvestRegion(region, output);
}
