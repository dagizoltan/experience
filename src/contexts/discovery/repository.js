
// src/contexts/discovery/repository.js

import { encode, getCoveringGeohashes } from "./domain/geohash.js";
import center from "npm:@turf/center";
import { feature } from "npm:@turf/helpers";

export const createPlaceRepository = ({ kv, ids, clock }) => {

  const _calculateGeohash = (geometry, precision = 4) => {
    let lat, lon;

    if (geometry.type === 'Point') {
      [lon, lat] = geometry.coordinates;
    } else {
      // For Polygon/LineString, calculate center
      // geometry object is a valid GeoJSON geometry
      const feat = feature(geometry);
      const c = center(feat);
      [lon, lat] = c.geometry.coordinates;
    }

    return encode(lat, lon, precision);
  };

  const _prepareRecord = (placeFeature) => {
    // placeFeature must be a valid GeoJSON Feature
    const id = placeFeature.id || ids.next();
    const now = clock.now();

    const record = {
      ...placeFeature,
      id, // Ensure ID is at root of record (Deno KV value), though valid GeoJSON allows id at root.
      properties: {
        ...placeFeature.properties,
        updatedAt: now,
        createdAt: placeFeature.properties.createdAt || now,
      }
    };

    const geohash = _calculateGeohash(record.geometry);
    record.geohash = geohash; // Store geohash at root for internal use, though not part of strict GeoJSON

    return record;
  };

  const _addToTransaction = (tx, record) => {
    // 1. Main Entity
    tx.set(['tenant', 'default', 'places', record.id], record);

    // 2. Geospatial Index
    tx.set(['index_geo', 4, record.geohash, record.id], record.id);

    // 3. Category Index (New)
    // Assuming properties.category exists.
    if (record.properties.category) {
       // Index by Category + Geohash to allow "Restaurants in this area"
       tx.set(['index_category', record.properties.category, record.geohash, record.id], record.id);
    }

    // 4. Search Index
    const tokens = new Set([
      ...record.properties.name.toLowerCase().split(/\s+/),
      ...(record.properties.tags || []).map(t => t.toLowerCase())
    ]);

    for (const token of tokens) {
      if (token.length > 2) {
         tx.set(['index_search', token, record.id], record.id);
      }
    }
  };

  const save = async (placeFeature) => {
    const record = _prepareRecord(placeFeature);
    const tx = kv.atomic();
    _addToTransaction(tx, record);

    const result = await tx.commit();
    if (!result.ok) {
      throw new Error('Failed to save place');
    }

    return record;
  };

  const saveAll = async (placeFeatures) => {
    const BATCH_SIZE = 25;
    let currentTx = kv.atomic();
    let opCount = 0;
    let placeCount = 0;

    for (const place of placeFeatures) {
      const record = _prepareRecord(place);

      // Estimate ops
      const tokens = new Set([
        ...record.properties.name.toLowerCase().split(/\s+/),
        ...(record.properties.tags || []).map(t => t.toLowerCase())
      ]);
      // 1(entity) + 1(geo) + 1(category) + N(tokens)
      const ops = 3 + [...tokens].filter(t => t.length > 2).length;

      _addToTransaction(currentTx, record);

      opCount += ops;
      placeCount++;

      if (placeCount >= BATCH_SIZE || opCount >= 500) {
        const result = await currentTx.commit();
        if (!result.ok) throw new Error('Failed to commit batch during saveAll');
        currentTx = kv.atomic();
        opCount = 0;
        placeCount = 0;
      }
    }

    if (placeCount > 0) {
      const result = await currentTx.commit();
      if (!result.ok) throw new Error('Failed to commit final batch in saveAll');
    }
  };

  const findInBounds = async (bbox) => {
    const { minLat, minLon, maxLat, maxLon } = bbox;
    const precision = 4;
    const hashes = getCoveringGeohashes(minLat, minLon, maxLat, maxLon, precision);

    if (hashes.length > 500) {
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
      ['index_category'],
      ['index_search']
    ];

    let currentTx = kv.atomic();
    let opCount = 0;
    const BATCH_SIZE = 100;

    for (const prefix of prefixes) {
      const iter = kv.list({ prefix });
      for await (const entry of iter) {
        currentTx.delete(entry.key);
        opCount++;

        if (opCount >= BATCH_SIZE) {
            await currentTx.commit();
            currentTx = kv.atomic();
            opCount = 0;
        }
      }
    }

    if (opCount > 0) {
        await currentTx.commit();
    }
  };

  return { save, saveAll, findInBounds, search, removeAll };
}
