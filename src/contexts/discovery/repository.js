
// src/contexts/discovery/repository.js

import { encode, getCoveringGeohashes } from "./domain/geohash.js";

export const createPlaceRepository = ({ kv, ids, clock }) => {

  const save = async (place) => {
    const id = place.id || ids.next();
    const now = clock.now();

    const record = {
      ...place,
      id,
      updatedAt: now,
      createdAt: place.createdAt || now,
    };

    const precision = 4;
    const geohash = encode(record.geometry.coordinates[1], record.geometry.coordinates[0], precision);
    record.geohash = geohash;

    const tx = kv.atomic();

    // 1. Main Entity
    tx.set(['tenant', 'default', 'places', id], record);

    // 2. Geospatial Index
    tx.set(['index_geo', precision, geohash, id], id);

    // 3. Search Index
    const tokens = new Set([
      ...record.properties.name.toLowerCase().split(/\s+/),
      ...(record.properties.tags || []).map(t => t.toLowerCase())
    ]);

    for (const token of tokens) {
      if (token.length > 2) {
         tx.set(['index_search', token, id], id);
      }
    }

    const result = await tx.commit();
    if (!result.ok) {
      throw new Error('Failed to save place');
    }

    return record;
  };

  const findInBounds = async (bbox) => {
    const { minLat, minLon, maxLat, maxLon } = bbox;

    // Always query at precision 4 as that is what we indexed
    const precision = 4;
    const hashes = getCoveringGeohashes(minLat, minLon, maxLat, maxLon, precision);

    if (hashes.length > 500) {
      // Safety cap for demo
      hashes.length = 500;
    }

    const promises = hashes.map(async (hash) => {
      const iter = kv.list({ prefix: ['index_geo', precision, hash] });
      const ids = [];
      for await (const entry of iter) {
        ids.push(entry.value);
      }
      return ids;
    });

    const idGroups = await Promise.all(promises);
    const uniqueIds = [...new Set(idGroups.flat())];

    const placePromises = uniqueIds.map(id => kv.get(['tenant', 'default', 'places', id]));
    const places = await Promise.all(placePromises);

    return places.map(p => p.value).filter(p => p !== null);
  };

  const search = async (query) => {
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (tokens.length === 0) return [];

    const firstToken = tokens[0];
    const iter = kv.list({ prefix: ['index_search', firstToken] });
    const ids = new Set();
    let count = 0;
    for await (const entry of iter) {
      ids.add(entry.value);
      count++;
      if (count > 50) break;
    }

    const placePromises = [...ids].map(id => kv.get(['tenant', 'default', 'places', id]));
    const places = await Promise.all(placePromises);

    return places.map(p => p.value).filter(p => p !== null);
  };

  const removeAll = async () => {
    const prefixes = [
      ['tenant', 'default', 'places'],
      ['index_geo'],
      ['index_search']
    ];

    for (const prefix of prefixes) {
      const iter = kv.list({ prefix });
      for await (const entry of iter) {
        await kv.delete(entry.key);
      }
    }
  };

  return { save, findInBounds, search, removeAll };
}
