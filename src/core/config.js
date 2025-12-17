// src/core/config.js

/**
 * Centralized Configuration Management
 * Provides type-safe access to environment variables with validation
 */

export const createConfig = () => {
  const env = Deno.env.toObject();

  /**
   * Get a configuration value with optional default
   */
  const get = (key, defaultValue) => {
    return env[key] ?? defaultValue;
  };

  /**
   * Get a required configuration value (throws if missing)
   */
  const getRequired = (key) => {
    const value = env[key];
    if (value === undefined || value === '') {
      throw new Error(`Required configuration missing: ${key}`);
    }
    return value;
  };

  /**
   * Get an integer configuration value
   */
  const getInt = (key, defaultValue) => {
    const value = env[key];
    if (value === undefined || value === '') {
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`Invalid integer for ${key}: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  };

  /**
   * Get a float configuration value
   */
  const getFloat = (key, defaultValue) => {
    const value = env[key];
    if (value === undefined || value === '') {
      return defaultValue;
    }
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      console.warn(`Invalid float for ${key}: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  };

  /**
   * Get a boolean configuration value
   */
  const getBool = (key, defaultValue = false) => {
    const value = env[key]?.toLowerCase();
    if (value === undefined || value === '') {
      return defaultValue;
    }
    return value === 'true' || value === '1' || value === 'yes';
  };

  /**
   * Get an array configuration value (comma-separated)
   */
  const getArray = (key, defaultValue = []) => {
    const value = env[key];
    if (value === undefined || value === '') {
      return defaultValue;
    }
    return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
  };

  return {
    get,
    getRequired,
    getInt,
    getFloat,
    getBool,
    getArray,
  };
};

/**
 * Application Configuration Schema
 * This provides a single source of truth for all configuration
 */
export const loadAppConfig = () => {
  const config = createConfig();

  return {
    // Environment
    env: config.get('DENO_ENV', 'development'),
    isDevelopment: config.get('DENO_ENV', 'development') === 'development',
    isProduction: config.get('DENO_ENV', 'development') === 'production',

    // Server
    server: {
      port: config.getInt('PORT', 8000),
      host: config.get('HOST', '0.0.0.0'),
    },

    // Database
    database: {
      path: config.get('KV_PATH', './data.db'),
    },

    // Map
    map: {
      apiKey: config.get('MAPTILER_KEY', 'l6tjy6mKiv4oNiZNY4pt'),
      defaultView: {
        lat: config.getFloat('DEFAULT_LAT', 41.75),
        lon: config.getFloat('DEFAULT_LON', 1.75),
        zoom: config.getInt('DEFAULT_ZOOM', 8),
      },
    },

    // Limits
    limits: {
      maxPlaces: config.getInt('MAX_PLACES', 2000),
      maxSearchResults: config.getInt('MAX_SEARCH_RESULTS', 100),
      searchMinLength: config.getInt('SEARCH_MIN_LENGTH', 3),
      maxBoundingBoxDegrees: config.getInt('MAX_BBOX_DEGREES', 10),
    },

    // CORS
    cors: {
      enabled: config.getBool('CORS_ENABLED', false),
      origins: config.getArray('CORS_ORIGINS', ['*']),
    },

    // Rate Limiting
    rateLimit: {
      enabled: config.getBool('RATE_LIMIT_ENABLED', false),
      maxRequestsPerMinute: config.getInt('RATE_LIMIT_RPM', 60),
    },

    // Harvest (for data collection scripts)
    harvest: {
      userAgent: config.get('HARVEST_USER_AGENT', 'Jules_Discovery_App/2.0'),
      overpassApi: config.get('OVERPASS_API', 'https://overpass-api.de/api/interpreter'),
      timeout: config.getInt('HARVEST_TIMEOUT', 180),
      retries: config.getInt('HARVEST_RETRIES', 3),
      delay: config.getInt('HARVEST_DELAY', 5000),
    },

    // Logging
    logging: {
      level: config.get('LOG_LEVEL', 'info'),
      format: config.get('LOG_FORMAT', 'text'), // 'text' or 'json'
    },
  };
};

/**
 * Validate configuration
 */
export const validateConfig = (appConfig) => {
  const errors = [];

  // Validate server port
  if (appConfig.server.port < 1 || appConfig.server.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }

  // Validate map default view
  if (appConfig.map.defaultView.lat < -90 || appConfig.map.defaultView.lat > 90) {
    errors.push('Default latitude must be between -90 and 90');
  }
  if (appConfig.map.defaultView.lon < -180 || appConfig.map.defaultView.lon > 180) {
    errors.push('Default longitude must be between -180 and 180');
  }
  if (appConfig.map.defaultView.zoom < 0 || appConfig.map.defaultView.zoom > 22) {
    errors.push('Default zoom must be between 0 and 22');
  }

  // Validate limits
  if (appConfig.limits.maxPlaces < 1) {
    errors.push('maxPlaces must be at least 1');
  }
  if (appConfig.limits.searchMinLength < 1) {
    errors.push('searchMinLength must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return true;
};

/**
 * Print configuration (for debugging)
 */
export const printConfig = (appConfig) => {
  console.log('📋 Application Configuration:');
  console.log(`  Environment: ${appConfig.env}`);
  console.log(`  Server: ${appConfig.server.host}:${appConfig.server.port}`);
  console.log(`  Database: ${appConfig.database.path}`);
  console.log(`  Default View: ${appConfig.map.defaultView.lat}, ${appConfig.map.defaultView.lon} @ zoom ${appConfig.map.defaultView.zoom}`);
  console.log(`  Max Places: ${appConfig.limits.maxPlaces}`);
  console.log(`  CORS: ${appConfig.cors.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`  Rate Limiting: ${appConfig.rateLimit.enabled ? 'Enabled' : 'Disabled'}`);
};
