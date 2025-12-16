
// scripts/seed_catalonia.js
import { createContainer } from "../src/core/container.js";
import { createKv } from "../src/adapters/kv/index.js";
import { createIds } from "../src/core/ports/ids.js";
import { createClock } from "../src/core/ports/clock.js";
import { createPlaceRepository } from "../src/contexts/discovery/repository.js";

const run = async () => {
  console.log("🌱 Seeding Catalonia Data...");

  // 1. Setup DI
  const container = createContainer();
  const kv = await createKv(); // Opens default KV

  container.register('kv', () => kv, 'singleton');
  container.register('ids', createIds, 'singleton');
  container.register('clock', createClock, 'singleton');
  container.register('discovery.repository', createPlaceRepository, 'singleton');

  const repo = container.resolve('discovery.repository');

  // 2. Define Data (Catalonia Points)
  // Lat: 40.5 - 42.5, Lon: 0.5 - 3.5

  const categories = ['gastronomy', 'culture', 'nature', 'nightlife'];
  const tagsMap = {
    gastronomy: ['tapas', 'paella', 'wine', 'catalan', 'michelin'],
    culture: ['history', 'museum', 'art', 'gaudi', 'architecture'],
    nature: ['beach', 'mountain', 'hiking', 'view'],
    nightlife: ['cocktails', 'pub', 'club', 'music']
  };

  const places = [
    // Barcelona (approx 41.38, 2.16)
    { name: "Sagrada Família", lat: 41.4036, lon: 2.1744, cat: 'culture', tags: ['gaudi', 'church'] },
    { name: "Park Güell", lat: 41.4145, lon: 2.1527, cat: 'nature', tags: ['gaudi', 'park'] },
    { name: "Casa Batlló", lat: 41.3917, lon: 2.1649, cat: 'culture', tags: ['gaudi', 'house'] },
    { name: "Camp Nou", lat: 41.3809, lon: 2.1228, cat: 'culture', tags: ['football', 'barca'] },
    { name: "El Xampanyet", lat: 41.3845, lon: 2.1811, cat: 'gastronomy', tags: ['tapas', 'historic'] },
    { name: "Bar Marsella", lat: 41.3787, lon: 2.1718, cat: 'nightlife', tags: ['absinthe', 'historic'] },
    { name: "Bunker del Carmel", lat: 41.4193, lon: 2.1616, cat: 'nature', tags: ['view', 'history'] },

    // Girona (approx 41.97, 2.82)
    { name: "Catedral de Girona", lat: 41.9875, lon: 2.8262, cat: 'culture', tags: ['got', 'history'] },
    { name: "El Celler de Can Roca", lat: 41.9937, lon: 2.8083, cat: 'gastronomy', tags: ['michelin', 'world_best'] },

    // Costa Brava
    { name: "Cala Pola", lat: 41.7450, lon: 2.9510, cat: 'nature', tags: ['beach', 'cove'] },
    { name: "Dali Museum", lat: 42.2680, lon: 2.9596, cat: 'culture', tags: ['art', 'surrealism'] }, // Figueres
    { name: "Cadaqués", lat: 42.2887, lon: 3.2779, cat: 'nature', tags: ['beach', 'white_village'] },

    // Tarragona
    { name: "Amphitheatre of Tarragona", lat: 41.1148, lon: 1.2593, cat: 'culture', tags: ['roman', 'history'] },

    // Pyrenees / Nature
    { name: "Montserrat Monastery", lat: 41.5931, lon: 1.8375, cat: 'culture', tags: ['mountain', 'monastery'] },
    { name: "Pedraforca", lat: 42.2372, lon: 1.7011, cat: 'nature', tags: ['mountain', 'hiking'] },
    { name: "Aigüestortes", lat: 42.5690, lon: 0.9423, cat: 'nature', tags: ['park', 'lakes'] }
  ];

  // Fill up to ~100 with random points near Barcelona and other hubs
  // To verify clustering and performance
  const hubs = [
    { lat: 41.38, lon: 2.16, r: 0.05 }, // BCN center
    { lat: 41.39, lon: 2.19, r: 0.03 }, // Poblenou
    { lat: 41.40, lon: 2.15, r: 0.04 }, // Gracia
  ];

  for (let i = 0; i < 80; i++) {
    const hub = hubs[i % hubs.length];
    const cat = categories[i % categories.length];

    places.push({
      name: `Random Spot ${i}`,
      lat: hub.lat + (Math.random() - 0.5) * hub.r,
      lon: hub.lon + (Math.random() - 0.5) * hub.r,
      cat: cat,
      tags: [cat, 'random']
    });
  }

  // 3. Save to Repo
  let count = 0;
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
    process.stdout.write('.');
    count++;
  }

  console.log(`\n✅ Seeded ${count} places!`);
}

run();
