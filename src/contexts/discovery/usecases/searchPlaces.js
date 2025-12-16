
// src/contexts/discovery/usecases/searchPlaces.js

export const createSearchPlaces = ({ discovery_repository }) => {
  return async (query) => {
    if (!query || query.length < 3) {
      return { type: 'FeatureCollection', features: [] };
    }

    const places = await discovery_repository.search(query);

    return {
      type: 'FeatureCollection',
      features: places
    };
  }
}
