import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

// Configuration for the demo: Valencia
const BBOX = "39.40, -0.45, 39.55, -0.30"; // Valencia city center approx
const LIMIT = 100;

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

const run = async () => {
  console.log(`🌍 Harvesting OSM data for BBox: [${BBOX}]...`);

  const query = `
    [out:json][timeout:25];
    (
      node["tourism"="museum"](${BBOX});
      node["historic"="castle"](${BBOX});
      node["natural"="beach"](${BBOX});
      node["amenity"="restaurant"]["cuisine"](${BBOX});
      node["leisure"="park"](${BBOX});
    );
    out body ${LIMIT};
    >;
    out skel qt;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!response.ok) {
      throw new Error(`Overpass API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const nodes = data.elements.filter(e => e.type === 'node' && e.tags && e.tags.name);

    console.log(`📦 Received ${nodes.length} raw items from OSM.`);

    const features = nodes.map(node => {
      const { category, tags } = mapToCategoryAndTags(node.tags);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [node.lon, node.lat] // GeoJSON is [lon, lat]
        },
        properties: {
          name: node.tags.name,
          category: category,
          tags: tags
        }
      };
    });

    console.log(`✅ Processed ${features.length} valid features.`);

    const yamlString = stringify(features);
    const outputPath = "seeds/valencia_sample.yaml";

    await Deno.writeTextFile(outputPath, yamlString);
    console.log(`💾 Saved to ${outputPath}`);

  } catch (error) {
    console.error("❌ Error harvesting data:", error);
  }
};

run();
