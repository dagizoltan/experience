
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
