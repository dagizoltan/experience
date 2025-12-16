
// src/adapters/web/server.tsx
import { Hono } from "hono";
import { render } from "preact-render-to-string";
import { createContainer } from "../../core/container.js";
import { createKv } from "../kv/index.js";
import { createIds } from "../../core/ports/ids.js";
import { createClock } from "../../core/ports/clock.js";
import { createPlaceRepository } from "../../contexts/discovery/repository.js";
import { createGetPlacesInBounds } from "../../contexts/discovery/usecases/getPlacesInBounds.js";
import { createSearchPlaces } from "../../contexts/discovery/usecases/searchPlaces.js";
import { createSeed } from "../../contexts/discovery/actions/seed.ts";
import { MapPage } from "./views/MapPage.tsx";

const app = new Hono();

// DI Setup
const container = createContainer();
const kv = await createKv();

container.register('kv', () => kv, 'singleton');
container.register('ids', createIds, 'singleton');
container.register('clock', createClock, 'singleton');
container.register('discovery.repository', createPlaceRepository, 'singleton');
container.register('discovery.getPlacesInBounds', createGetPlacesInBounds, 'transient');
container.register('discovery.searchPlaces', createSearchPlaces, 'transient');
// Seed needs the repository instance directly if we are resolving it manually or use dependency injection properly.
// The createSeed factory expects the repository.
// Let's resolve the repository first.
const repo = container.resolve('discovery.repository');
container.register('discovery.seed', () => createSeed(repo), 'singleton');

// Auto-seed on startup
try {
  const seed = container.resolve('discovery.seed');
  // We don't await this to avoid blocking startup, but for Deno Deploy cold starts it might be better to await
  // to ensure data is there for the first request.
  // Given it's fast (~500 items), awaiting is safer.
  await seed();
} catch (err) {
  console.error("Failed to seed on startup:", err);
}

app.get('/', async (c) => {
  const getPlaces = container.resolve('discovery.getPlacesInBounds');

  // Focused View: Catalonia
  const view = {
    lat: 41.75,
    lon: 1.75,
    zoom: 8,
    minLat: 40.5, minLon: 0.0,
    maxLat: 43.0, maxLon: 3.5
  };

  const places = await getPlaces({
    minLat: view.minLat,
    minLon: view.minLon,
    maxLat: view.maxLat,
    maxLon: view.maxLon
  });

  const mapApiKey = Deno.env.get("MAPTILER_KEY") ?? "l6tjy6mKiv4oNiZNY4pt";

  const html = render(<MapPage initialPlaces={places} initialView={view} mapApiKey={mapApiKey} />);
  return c.html('<!DOCTYPE html>' + html);
});

app.get('/api/search', async (c) => {
  const q = c.req.query('q');
  const searchPlaces = container.resolve('discovery.searchPlaces');

  const result = await searchPlaces(q);
  return c.json(result);
});

app.get('/api/places', async (c) => {
  const { minLat, minLon, maxLat, maxLon } = c.req.query();
  const getPlaces = container.resolve('discovery.getPlacesInBounds');

  try {
    const result = await getPlaces({
      minLat: parseFloat(minLat),
      minLon: parseFloat(minLon),
      maxLat: parseFloat(maxLat),
      maxLon: parseFloat(maxLon)
    });
    return c.json(result);
  } catch (e) {
    return c.json({ error: e.message }, 400);
  }
});

console.log("🚀 Server running on http://localhost:8000");
Deno.serve({ port: 8000 }, app.fetch);
