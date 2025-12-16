
// src/contexts/discovery/usecases/getPlacesInBounds.js

export const createGetPlacesInBounds = ({ discovery_repository }) => {
  return async (bbox) => {
    // Validate bbox
    if (bbox.minLat > bbox.maxLat || bbox.minLon > bbox.maxLon) {
      throw new Error('Invalid bounding box');
    }

    const places = await discovery_repository.findInBounds(bbox);

    // Convert to GeoJSON FeatureCollection
    return {
      type: 'FeatureCollection',
      features: places
    };
  }
}
