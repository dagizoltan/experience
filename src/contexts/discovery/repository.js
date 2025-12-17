// src/contexts/discovery/repository.js

import { encode, getCoveringGeohashes } from "./domain/geohash.js";
import center from "npm:@turf/center";
import { feature } from "npm:@turf/helpers";

/**
 * Repository Configuration
 */
const REPO_CONFIG = {
  geohash: {
    defaultPrecision: 4,
    maxPrecisionForBounds: 5,
  },
  limits: {
    defaultLimit: 2000,
    maxHashesPerQuery: 500,
    batchSize: 25,
    getManybatchSize: 10,
    maxOperationsPerTransaction: 500,
  },
  indexes: {
    entity: ['tenant', 'default', 'places'],
    geo: ['index_geo'],
    category: ['index_category'],
    search: ['index_search'],
  },
};

export const createPlaceRepository = ({ kv, ids, clock }) => {

  /**
   * Calculate geohash for a geometry
   */
  const _calculateGeohash = (geometry, precision = REPO_CONFIG.geohash.defaultPrecision) => {
    let lat, lon;

    if (geometry.type === 'Point') {
      [lon, lat] = geometry.coordinates;
    } else {
      // For Polygon/LineString, calculate center
      const feat = feature(geometry);
      const c = center(feat);
      [lon, lat] = c.geometry.coordinates;
    }

    return encode(lat, lon, precision);
  };

  /**
   * Prepare a place feature for storage
   */
  const _prepareRecord = (placeFeature) => {
    if (!placeFeature.geometry) {
      throw new Error('Place feature must have a geometry');
    }

    if (!placeFeature.properties?.name) {
      throw new Error('Place feature must have a name property');
    }

    const id = placeFeature.id || ids.next();
    const now = clock.now();

    const record = {
      type: 'Feature',
      ...placeFeature,
      id,
      properties: {
        ...placeFeature.properties,
        updatedAt: now,
        createdAt: placeFeature.properties.createdAt || now,
      }
    };

    // Calculate and store geohash
    const geohash = _calculateGeohash(record.geometry);
    record.geohash = geohash;

    return record;
  };

  /**
   * Estimate number of operations for a record
   */
  const _estimateOperations = (record) => {
    const tokens = _extractSearchTokens(record);
    // 1 (entity) + 1 (geo) + 1 (category if exists) + N (tokens)
    let ops = 2;
    if (record.properties.category) ops += 1;
    ops += tokens.size;
    return ops;
  };

  /**
   * Extract search tokens from a record
   */
  const _extractSearchTokens = (record) => {
    const tokens = new Set();

    // Add name tokens
    const nameTokens = record.properties.name
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);
    nameTokens.forEach(t => tokens.add(t));

    // Add tag tokens
    const tags = record.properties.tags || [];
    if (Array.isArray(tags)) {
      tags.forEach(tag => {
        const normalized = String(tag).toLowerCase().trim();
        if (normalized.length > 2) {
          tokens.add(normalized);
        }
      });
    }

    // Add category as token
    if (record.properties.category) {
      const cat = record.properties.category.toLowerCase().replace('_', ' ');
      tokens.add(cat);
    }

    return tokens;
  };

  /**
   * Add a record to a transaction
   */
  const _addToTransaction = (tx, record) => {
    try {
      // 1. Main Entity
      tx.set([...REPO_CONFIG.indexes.entity, record.id], record);

      // 2. Geospatial Index
      tx.set([
        ...REPO_CONFIG.indexes.geo,
        REPO_CONFIG.geohash.defaultPrecision,
        record.geohash,
        record.id
      ], record.id);

      // 3. Category Index
      if (record.properties.category) {
        tx.set([
          ...REPO_CONFIG.indexes.category,
          record.properties.category,
          record.geohash,
          record.id
        ], record.id);
      }

      // 4. Search Index
      const tokens = _extractSearchTokens(record);
      for (const token of tokens) {
        tx.set([...REPO_CONFIG.indexes.search, token, record.id], record.id);
      }
    } catch (error) {
      console.error('Error adding record to transaction:', error);
      throw new Error(`Failed to add record to transaction: ${error.message}`);
    }
  };

  /**
   * Save a single place
   */
  const save = async (placeFeature) => {
    try {
      const record = _prepareRecord(placeFeature);
      const tx = kv.atomic();
      _addToTransaction(tx, record);

      const result = await tx.commit();
      if (!result.ok) {
        throw new Error('Transaction failed to commit');
      }

      return record;
    } catch (error) {
      console.error('Error saving place:', error);
      throw error;
    }
  };

  /**
   * Save multiple places in optimized batches
   */
  const saveAll = async (placeFeatures) => {
    if (!Array.isArray(placeFeatures) || placeFeatures.length === 0) {
      return;
    }

    let currentTx = kv.atomic();
    let opCount = 0;
    let placeCount = 0;
    let totalSaved = 0;

    try {
      for (const place of placeFeatures) {
        const record = _prepareRecord(place);
        const ops = _estimateOperations(record);

        _addToTransaction(currentTx, record);

        opCount += ops;
        placeCount++;

        // Commit batch if limits reached
        if (
          placeCount >= REPO_CONFIG.limits.batchSize ||
          opCount >= REPO_CONFIG.limits.maxOperationsPerTransaction
        ) {
          const result = await currentTx.commit();
          if (!result.ok) {
            throw new Error('Failed to commit batch during saveAll');
          }

          totalSaved += placeCount;
          console.log(`Saved batch: ${placeCount} places (${totalSaved} total)`);

          // Reset for next batch
          currentTx = kv.atomic();
          opCount = 0;
          placeCount = 0;
        }
      }

      // Commit remaining
      if (placeCount > 0) {
        const result = await currentTx.commit();
        if (!result.ok) {
          throw new Error('Failed to commit final batch in saveAll');
        }
        totalSaved += placeCount;
        console.log(`Saved final batch: ${placeCount} places (${totalSaved} total)`);
      }

      return totalSaved;
    } catch (error) {
      console.error('Error in saveAll:', error);
      throw error;
    }
  };

  /**
   * Find places within a bounding box
   */
  const findInBounds = async (bbox, limit = REPO_CONFIG.limits.defaultLimit) => {
    try {
      const { minLat, minLon, maxLat, maxLon } = bbox;

      // Validate bounds
      if (minLat >= maxLat || minLon >= maxLon) {
        throw new Error('Invalid bounding box');
      }

      const precision = REPO_CONFIG.geohash.defaultPrecision;
      const hashes = getCoveringGeohashes(minLat, minLon, maxLat, maxLon, precision);

      // Limit number of hashes to prevent excessive queries
      const limitedHashes = hashes.slice(0, REPO_CONFIG.limits.maxHashesPerQuery);

      if (hashes.length > limitedHashes.length) {
        console.warn(`Truncated geohashes from ${hashes.length} to ${limitedHashes.length}`);
      }

      // Fetch IDs in parallel
      const promises = limitedHashes.map(async (hash) => {
        const iter = kv.list({
          prefix: [...REPO_CONFIG.indexes.geo, precision, hash]
        });

        const ids = [];
        for await (const entry of iter) {
          ids.push(entry.value);
          if (ids.length >= limit) break;
        }
        return ids;
      });

      const idGroups = await Promise.all(promises);
      const uniqueIds = [...new Set(idGroups.flat())];

      // Apply limit
      const limitedIds = uniqueIds.slice(0, limit);

      // Fetch entities in batches
      const places = [];
      const batchSize = REPO_CONFIG.limits.getManybatchSize;

      for (let i = 0; i < limitedIds.length; i += batchSize) {
        const batchIds = limitedIds
          .slice(i, i + batchSize)
          .map(id => [...REPO_CONFIG.indexes.entity, id]);

        const batchResults = await kv.getMany(batchIds);

        for (const res of batchResults) {
          if (res.value) {
            places.push(res.value);
          }
        }
      }

      return places;
    } catch (error) {
      console.error('Error in findInBounds:', error);
      throw error;
    }
  };

  /**
   * Search places by query string
   */
  const search = async (query, limit = 50) => {
    try {
      if (!query || typeof query !== 'string') {
        return [];
      }

      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length > 2);

      if (tokens.length === 0) {
        return [];
      }

      // Use first token for primary search
      const firstToken = tokens[0];
      const iter = kv.list({
        prefix: [...REPO_CONFIG.indexes.search, firstToken]
      });

      const ids = new Set();
      let count = 0;

      for await (const entry of iter) {
        ids.add(entry.value);
        count++;
        if (count >= limit * 2) break; // Fetch more for filtering
      }

      // Fetch places
      const idArray = [...ids].slice(0, limit * 2);
      const batchSize = REPO_CONFIG.limits.getManybatchSize;
      const places = [];

      for (let i = 0; i < idArray.length; i += batchSize) {
        const batchIds = idArray
          .slice(i, i + batchSize)
          .map(id => [...REPO_CONFIG.indexes.entity, id]);

        const batchResults = await kv.getMany(batchIds);

        for (const res of batchResults) {
          if (res.value) {
            places.push(res.value);
          }
        }
      }

      // Filter by additional tokens
      if (tokens.length > 1) {
        const filtered = places.filter(place => {
          const placeTokens = _extractSearchTokens(place);
          const placeTokenStr = [...placeTokens].join(' ');
          return tokens.every(t => placeTokenStr.includes(t));
        });
        return filtered.slice(0, limit);
      }

      return places.slice(0, limit);
    } catch (error) {
      console.error('Error in search:', error);
      throw error;
    }
  };

  /**
   * Find by category within bounds
   */
  const findByCategory = async (category, bbox, limit = REPO_CONFIG.limits.defaultLimit) => {
    try {
      const { minLat, minLon, maxLat, maxLon } = bbox;
      const precision = REPO_CONFIG.geohash.defaultPrecision;
      const hashes = getCoveringGeohashes(minLat, minLon, maxLat, maxLon, precision);
      const limitedHashes = hashes.slice(0, REPO_CONFIG.limits.maxHashesPerQuery);

      // Fetch IDs by category + geohash
      const promises = limitedHashes.map(async (hash) => {
        const iter = kv.list({
          prefix: [...REPO_CONFIG.indexes.category, category, hash]
        });

        const ids = [];
        for await (const entry of iter) {
          ids.push(entry.value);
          if (ids.length >= limit) break;
        }
        return ids;
      });

      const idGroups = await Promise.all(promises);
      const uniqueIds = [...new Set(idGroups.flat())];
      const limitedIds = uniqueIds.slice(0, limit);

      // Fetch entities
      const places = [];
      const batchSize = REPO_CONFIG.limits.getManybatchSize;

      for (let i = 0; i < limitedIds.length; i += batchSize) {
        const batchIds = limitedIds
          .slice(i, i + batchSize)
          .map(id => [...REPO_CONFIG.indexes.entity, id]);

        const batchResults = await kv.getMany(batchIds);

        for (const res of batchResults) {
          if (res.value) {
            places.push(res.value);
          }
        }
      }

      return places;
    } catch (error) {
      console.error('Error in findByCategory:', error);
      throw error;
    }
  };

  /**
   * Get single place by ID
   */
  const findById = async (id) => {
    try {
      const result = await kv.get([...REPO_CONFIG.indexes.entity, id]);
      return result.value;
    } catch (error) {
      console.error('Error in findById:', error);
      throw error;
    }
  };

  /**
   * Remove all places (for testing/reseeding)
   */
  const removeAll = async () => {
    const prefixes = Object.values(REPO_CONFIG.indexes);

    let currentTx = kv.atomic();
    let opCount = 0;
    const batchSize = 100;

    try {
      for (const prefix of prefixes) {
        const iter = kv.list({ prefix });

        for await (const entry of iter) {
          currentTx.delete(entry.key);
          opCount++;

          if (opCount >= batchSize) {
            await currentTx.commit();
            currentTx = kv.atomic();
            opCount = 0;
          }
        }
      }

      if (opCount > 0) {
        await currentTx.commit();
      }

      console.log('All places removed');
    } catch (error) {
      console.error('Error in removeAll:', error);
      throw error;
    }
  };

  /**
   * Get repository statistics
   */
  const getStats = async () => {
    try {
      const stats = {
        totalPlaces: 0,
        byCategory: {},
        indexSizes: {},
      };

      // Count total places
      const placesIter = kv.list({ prefix: REPO_CONFIG.indexes.entity });
      for await (const entry of placesIter) {
        stats.totalPlaces++;
        const category = entry.value?.properties?.category;
        if (category) {
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  };

  return {
    save,
    saveAll,
    findInBounds,
    findByCategory,
    findById,
    search,
    removeAll,
    getStats,
  };
};
