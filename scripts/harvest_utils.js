// scripts/harvest_utils.js
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";

export const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
export const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

// Maps OSM tags to our Refined App Taxonomy
export function mapToCategoryAndTags(osmTags) {
  let category = 'hidden_gems'; // default fallback
  let tags = [];

  // Helper to push split tags
  const addTags = (value) => {
    if (!value) return;
    const parts = value.split(';').map(t => t.trim().toLowerCase());
    tags.push(...parts);
  };

  // --- CULTURE ---
  if (osmTags.historic === 'castle' || osmTags.historic === 'ruins' || osmTags.historic === 'battlefield' || osmTags.historic === 'archaeological_site') {
    category = 'culture';
    tags.push('history', osmTags.historic);
  }
  else if (osmTags.historic === 'monument' || osmTags.historic === 'memorial' || osmTags.tourism === 'attraction') {
    category = 'culture';
    tags.push('landmark', 'history');
  }
  else if (osmTags.tourism === 'museum' || osmTags.amenity === 'arts_centre' || osmTags.tourism === 'gallery') {
    category = 'culture';
    tags.push('art', 'museum');
  }
  else if (osmTags.amenity === 'place_of_worship' || osmTags.historic === 'church' || osmTags.historic === 'monastery') {
    category = 'culture';
    tags.push('religious', 'architecture');
    if (osmTags.religion) addTags(osmTags.religion);
  }

  // --- GASTRONOMY ---
  else if (osmTags.amenity === 'restaurant') {
    category = 'gastronomy';
    tags.push('restaurant');
    addTags(osmTags.cuisine);
  }
  else if (osmTags.craft === 'winery' || osmTags.shop === 'wine' || osmTags.tourism === 'wine_cellar') {
    category = 'gastronomy';
    tags.push('winery', 'wine');
  }
  else if (osmTags.amenity === 'cafe' && (osmTags.historic || osmTags.cuisine === 'regional')) {
    // Only capture historic or special cafes to avoid spam
    category = 'gastronomy';
    tags.push('cafe');
  }

  // --- NATURE ---
  else if (osmTags.natural === 'beach') {
    category = 'nature';
    tags.push('beach', 'sea');
  }
  else if (osmTags.natural === 'peak' || osmTags.natural === 'cave_entrance' || osmTags.natural === 'cliff') {
    category = 'nature';
    tags.push('mountain', 'view');
    if (osmTags.natural === 'cave_entrance') tags.push('cave');
  }
  else if (osmTags.leisure === 'park' || osmTags.leisure === 'nature_reserve' || osmTags.boundary === 'national_park') {
    category = 'nature';
    tags.push('park', 'outdoors');
  }

  // --- ENTERTAINMENT / FAMILY ---
  else if (osmTags.tourism === 'theme_park' || osmTags.leisure === 'water_park') {
    category = 'family';
    tags.push('theme_park', 'fun');
    if (osmTags.leisure === 'water_park') tags.push('water_park');
  }
  else if (osmTags.tourism === 'zoo' || osmTags.tourism === 'aquarium') {
    category = 'family';
    tags.push('zoo', 'animals');
  }

  // --- WELLNESS ---
  else if (osmTags.amenity === 'public_bath' || osmTags.leisure === 'sauna' || (osmTags.amenity === 'spa')) {
    category = 'wellness';
    tags.push('spa', 'relax');
    if (osmTags.bath === 'thermal') tags.push('thermal');
  }

  // Deduplicate tags
  tags = [...new Set(tags)];

  // Cleanup: Remove generic/useless tags
  tags = tags.filter(t => t !== 'yes' && t !== 'no');

  return { category, tags };
}

// Fetch Area ID for a given place name (Country or Region)
export async function getAreaId(placeName) {
  // console.log(`🔍 Resolving area ID for "${placeName}"...`);
  const url = `${NOMINATIM_API_URL}?q=${encodeURIComponent(placeName)}&format=json&polygon_geojson=0&limit=1`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'JulesApp/1.0' }
  });

  if (!response.ok) throw new Error(`Nominatim API Error: ${response.statusText}`);

  const data = await response.json();
  if (!data || data.length === 0) return null;

  const place = data[0];
  if (place.osm_type === 'relation') {
    return parseInt(place.osm_id) + 3600000000;
  }
  return null;
}

// Fetch direct sub-regions (admin_level 4 usually states/provinces)
export async function fetchSubRegions(countryName) {
  console.log(`🗺️  Fetching sub-regions for ${countryName}...`);
  const countryAreaId = await getAreaId(countryName);

  if (!countryAreaId) throw new Error(`Could not resolve country: ${countryName}`);

  const query = `
    [out:json][timeout:30];
    area(${countryAreaId})->.country;
    relation(area.country)["admin_level"="4"]["boundary"="administrative"];
    out tags;
  `;

  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) throw new Error(`Overpass Subregion Error: ${response.statusText}`);

  const data = await response.json();
  return data.elements.map(el => el.tags['name:en'] || el.tags.name).filter(Boolean);
}

// Helper: Sleep
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
