export const createRateLimiter = (maxRequests = 60, windowMs = 60000) => {
  const requests = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, timestamps] of requests.entries()) {
      const filtered = timestamps.filter(t => now - t < windowMs);
      if (filtered.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, filtered);
      }
    }
  };

  // Cleanup every minute
  setInterval(cleanup, 60000);

  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const now = Date.now();

    if (!requests.has(ip)) {
      requests.set(ip, []);
    }

    const timestamps = requests.get(ip);
    const recentRequests = timestamps.filter(t => now - t < windowMs);

    if (recentRequests.length >= maxRequests) {
      return c.json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000),
        },
        429
      );
    }

    recentRequests.push(now);
    requests.set(ip, recentRequests);

    await next();
  };
};
