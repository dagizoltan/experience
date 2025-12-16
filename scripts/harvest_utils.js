// scripts/harvest_utils.js
import { stringify } from "https://deno.land/std@0.224.0/yaml/mod.ts";

export const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
export const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

// Maps OSM tags to our App's Taxonomy
export function mapToCategoryAndTags(osmTags) {
  let category = 'hidden_gems'; // default fallback
  let tags = [];

  // Culture
  if (osmTags.tourism === 'museum' || osmTags.amenity === 'arts_centre') {
    category = 'culture';
    tags.push('museum', 'art');
  } else if (osmTags.historic === 'castle' || osmTags.historic === 'monument' || osmTags.tourism === 'attraction') {
    category = 'culture';
    tags.push('history', 'landmark');
  } else if (osmTags.historic === 'church' || osmTags.amenity === 'place_of_worship') {
    category = 'culture';
    tags.push('religious', 'architecture');
  }

  // Gastronomy
  else if (osmTags.amenity === 'restaurant' || osmTags.amenity === 'bar' || osmTags.amenity === 'cafe') {
    category = 'gastronomy';
    tags.push(osmTags.amenity);
    if (osmTags.cuisine) tags.push(osmTags.cuisine);
  }

  // Nature
  else if (osmTags.natural === 'beach' || osmTags.natural === 'peak' || osmTags.natural === 'volcano') {
    category = 'nature';
    tags.push('nature', osmTags.natural);
  } else if (osmTags.leisure === 'park' || osmTags.leisure === 'nature_reserve') {
    category = 'nature';
    tags.push('park', 'outdoors');
  }

  // Family
  else if (osmTags.leisure === 'water_park' || osmTags.tourism === 'theme_park' || osmTags.tourism === 'zoo') {
    category = 'family';
    tags.push('fun', 'kids');
  }

  // Wellness
  else if (osmTags.amenity === 'spa' || osmTags.leisure === 'sauna') {
    category = 'wellness';
    tags.push('relax', 'spa');
  }

  // Shopping
  else if (osmTags.shop === 'mall' || osmTags.shop === 'market') {
    category = 'shopping';
    tags.push(osmTags.shop);
  }

  // Deduplicate tags
  tags = [...new Set(tags)];
  return { category, tags };
}

// Fetch Area ID for a given place name (Country or Region)
export async function getAreaId(placeName) {
  console.log(`🔍 Resolving area ID for "${placeName}"...`);
  // polygon_geojson=0 makes it faster, we just need the OSM ID
  const url = `${NOMINATIM_API_URL}?q=${encodeURIComponent(placeName)}&format=json&polygon_geojson=0&limit=1`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'JulesApp/1.0' }
  });

  if (!response.ok) throw new Error(`Nominatim API Error: ${response.statusText}`);

  const data = await response.json();
  if (!data || data.length === 0) return null; // Not found

  const place = data[0];
  // Prefer relations for administrative boundaries
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

  // Query for admin_level 4 (regions/autonomous communities) within the country
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
  // Extract English name, or local name
  return data.elements.map(el => el.tags['name:en'] || el.tags.name).filter(Boolean);
}

// Helper: Sleep
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
