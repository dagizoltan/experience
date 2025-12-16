
// src/contexts/discovery/domain/geohash.js
import ngeohash from "npm:ngeohash";

export const encode = (lat, lon, precision = 9) => {
  return ngeohash.encode(lat, lon, precision);
}

export const decode = (hash) => {
  return ngeohash.decode(hash);
}

export const bboxes = (minLat, minLon, maxLat, maxLon, precision) => {
  return ngeohash.bboxes(minLat, minLon, maxLat, maxLon, precision);
}

/**
 * Calculates which geohash boxes cover the given bounding box
 * This is crucial for querying "Everything in this map view"
 */
export const getCoveringGeohashes = (minLat, minLon, maxLat, maxLon, precision = 5) => {
  // Simple strategy: get the bboxes from ngeohash
  return ngeohash.bboxes(minLat, minLon, maxLat, maxLon, precision);
}
