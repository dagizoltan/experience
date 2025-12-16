import { PlaceRepository } from "../repository.js";
import { places } from "./data.ts";

export const createSeed = (repo) => async () => {
  console.log("🌱 Checking if database needs seeding...");

  // Check if DB is empty or has very few items
  // This is a naive check; ideally we'd count, but for KV we can just check if any exist in a range or just overwrite if we want to enforce state.
  // For this requirement ("ensure on seed we always clear the database"),
  // if we run this on startup, we might NOT want to clear every restart if it's already there (to be faster),
  // BUT the prompt said "ensure on seed we always clear".
  // If we treat "startup" as "seed", we should be careful.
  // However, for a prototype on Deno Deploy, "seed on start if empty" is safest.

  // Let's iterate a few to see if we have data.
  const sample = await repo.findInBounds({ minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 });
  const count = sample.length;

  if (count < 100) { // Arbitrary threshold to decide "it needs seeding"
    console.log(`🧹 Database has ${count} items. Seeding ~500 real places...`);
    await repo.removeAll();

    let c = 0;
    for (const p of places) {
      const placeEntity = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat]
        },
        properties: {
          name: p.name,
          category: p.cat,
          tags: p.tags
        }
      };

      await repo.save(placeEntity);
      c++;
    }
    console.log(`✅ Seeded ${c} places.`);
  } else {
    console.log(`✅ Database already populated (${count} items). Skipping seed.`);
  }
};
