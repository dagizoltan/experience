// src/adapters/web/server.tsx
import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { render } from "preact-render-to-string";
import { createContainer } from "../../core/container.js";
import { createKv } from "../kv/index.js";
import { createIds } from "../../core/ports/ids.js";
import { createClock } from "../../core/ports/clock.js";
import { createPlaceRepository } from "../../contexts/discovery/repository.js";
import { createGetPlacesInBounds } from "../../contexts/discovery/usecases/getPlacesInBounds.js";
import { createSearchPlaces } from "../../contexts/discovery/usecases/searchPlaces.js";
import { MapPage } from "./views/MapPage.tsx";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { createMetrics } from "./middleware/metrics.js";
import { loadAppConfig, validateConfig, printConfig } from "../../core/config.js";

// Load and validate config
const appConfig = loadAppConfig();
validateConfig(appConfig);
printConfig(appConfig);

// Validation helpers
const validateBounds = (minLat: number, minLon: number, maxLat: number, maxLon: number) => {
  const errors = [];

  if (isNaN(minLat) || minLat < -90 || minLat > 90) {
    errors.push("minLat must be between -90 and 90");
  }
  if (isNaN(maxLat) || maxLat < -90 || maxLat > 90) {
    errors.push("maxLat must be between -90 and 90");
  }
  if (isNaN(minLon) || minLon < -180 || minLon > 180) {
    errors.push("minLon must be between -180 and 180");
  }
  if (isNaN(maxLon) || maxLon < -180 || maxLon > 180) {
    errors.push("maxLon must be between -180 and 180");
  }
  if (minLat >= maxLat) {
    errors.push("minLat must be less than maxLat");
  }
  if (minLon >= maxLon) {
    errors.push("minLon must be less than maxLon");
  }

  // Check if bounds are too large (prevent abuse)
  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;
  const maxDegrees = appConfig.limits.maxBoundingBoxDegrees;
  if (latDiff > maxDegrees || lonDiff > maxDegrees) {
    errors.push(`Bounding box is too large (max ${maxDegrees} degrees in each direction)`);
  }

  return errors;
};

const validateSearchQuery = (query: string) => {
  const errors = [];

  if (!query) {
    errors.push("Query parameter 'q' is required");
  } else if (query.length < appConfig.limits.searchMinLength) {
    errors.push(`Query must be at least ${appConfig.limits.searchMinLength} characters`);
  } else if (query.length > 100) {
    errors.push("Query must be at most 100 characters");
  }

  return errors;
};

// Error response helper
const errorResponse = (c: any, status: number, message: string, errors?: string[]) => {
  return c.json(
    {
      error: message,
      details: errors,
      timestamp: new Date().toISOString(),
    },
    status
  );
};

// Initialize app
const app = new Hono();

// Initialize metrics
const { middleware: metricsMiddleware, getMetrics } = createMetrics();
app.use("*", metricsMiddleware);

// Request logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${c.res.status} (${ms}ms)`);
});

// CORS middleware (if enabled)
if (appConfig.cors.enabled) {
  app.use("*", async (c, next) => {
    await next();
    // For simplicity using * if origin is *
    const allowedOrigin = appConfig.cors.origins.includes("*") ? "*" : appConfig.cors.origins[0];
    c.header("Access-Control-Allow-Origin", allowedOrigin);
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
  });

  app.options("*", (c) => c.text("", 204));
}

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' unpkg.com cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' unpkg.com cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' api.maptiler.com;"
  );
});

// Rate limiting
if (appConfig.rateLimit.enabled) {
    app.use("*", createRateLimiter(appConfig.rateLimit.maxRequestsPerMinute));
}

// DI Setup
const container = createContainer();
const kv = await createKv(appConfig.database.path);

container.register("kv", () => kv, "singleton");
container.register("ids", createIds, "singleton");
container.register("clock", createClock, "singleton");
container.register("discovery.repository", createPlaceRepository, "singleton");
container.register("discovery.getPlacesInBounds", createGetPlacesInBounds, "transient");
container.register("discovery.searchPlaces", createSearchPlaces, "transient");

// Static files middleware
app.use("/static/*", serveStatic({ root: "./src/adapters/web" }));

// Routes

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Metrics
app.get('/metrics', (c) => {
  return c.json(getMetrics());
});

// Main page
app.get("/", async (c) => {
  try {
    const initialPlaces = { type: "FeatureCollection", features: [] };

    const html = render(
      <MapPage
        initialPlaces={initialPlaces}
        initialView={appConfig.map.defaultView}
        mapApiKey={appConfig.map.apiKey}
      />
    );

    return c.html("<!DOCTYPE html>" + html);
  } catch (error) {
    console.error("Error rendering page:", error);
    return c.text("Internal Server Error", 500);
  }
});

// Search API
app.get("/api/search", async (c) => {
  try {
    const q = c.req.query("q");

    if (!q) {
      return errorResponse(c, 400, "Missing query parameter", ["Parameter 'q' is required"]);
    }

    const validationErrors = validateSearchQuery(q);
    if (validationErrors.length > 0) {
      return errorResponse(c, 400, "Invalid search query", validationErrors);
    }

    const searchPlaces = container.resolve("discovery.searchPlaces");
    const result = await searchPlaces(q);

    // Limit results
    if (result.features.length > appConfig.limits.maxSearchResults) {
      result.features = result.features.slice(0, appConfig.limits.maxSearchResults);
    }

    return c.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return errorResponse(c, 500, "Internal server error during search");
  }
});

// Places in bounds API
app.get("/api/places", async (c) => {
  try {
    const { minLat, minLon, maxLat, maxLon } = c.req.query();

    // Validate presence
    if (!minLat || !minLon || !maxLat || !maxLon) {
      return errorResponse(c, 400, "Missing required parameters", [
        "Parameters minLat, minLon, maxLat, maxLon are required",
      ]);
    }

    // Parse
    const bounds = {
      minLat: parseFloat(minLat),
      minLon: parseFloat(minLon),
      maxLat: parseFloat(maxLat),
      maxLon: parseFloat(maxLon),
    };

    // Validate
    const validationErrors = validateBounds(
      bounds.minLat,
      bounds.minLon,
      bounds.maxLat,
      bounds.maxLon
    );

    if (validationErrors.length > 0) {
      return errorResponse(c, 400, "Invalid bounding box", validationErrors);
    }

    const getPlaces = container.resolve("discovery.getPlacesInBounds");
    const result = await getPlaces(bounds, appConfig.limits.maxPlaces);

    return c.json(result);
  } catch (error) {
    console.error("Places fetch error:", error);
    return errorResponse(c, 500, "Internal server error while fetching places");
  }
});

// API documentation endpoint
app.get("/api", (c) => {
  return c.json({
    version: "1.0.0",
    endpoints: [
      {
        path: "/api/places",
        method: "GET",
        description: "Get places within a bounding box",
        parameters: {
          minLat: "number (required, -90 to 90)",
          minLon: "number (required, -180 to 180)",
          maxLat: "number (required, -90 to 90)",
          maxLon: "number (required, -180 to 180)",
        },
        example: "/api/places?minLat=41.0&minLon=1.0&maxLat=42.0&maxLon=2.0",
      },
      {
        path: "/api/search",
        method: "GET",
        description: "Search places by name or tags",
        parameters: {
          q: `string (required, min ${appConfig.limits.searchMinLength} chars, max 100 chars)`,
        },
        example: "/api/search?q=restaurant",
      },
    ],
  });
});

// 404 handler
app.notFound((c) => {
  if (c.req.url.includes("/api/")) {
    return errorResponse(c, 404, "Endpoint not found");
  }
  return c.text("404 - Page Not Found", 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return errorResponse(c, 500, "Internal server error");
});

// Start server
console.log(`🚀 Server starting on http://${appConfig.server.host}:${appConfig.server.port}`);
console.log(`📍 Default view: ${appConfig.map.defaultView.lat}, ${appConfig.map.defaultView.lon}`);
console.log(`🗺️  Map provider: MapTiler`);

Deno.serve(
  {
    port: appConfig.server.port,
    hostname: appConfig.server.host,
    onListen: ({ port, hostname }) => {
      console.log(`✅ Server running on http://${hostname}:${port}`);
    },
  },
  app.fetch
);
