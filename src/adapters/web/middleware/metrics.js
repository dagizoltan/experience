export const createMetrics = () => {
  const metrics = {
    requests: {
      total: 0,
      by_status: {},
      by_path: {},
    },
    response_times: [],
    errors: 0,
  };

  const calculateP95 = (times) => {
    if (times.length === 0) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  };

  const middleware = async (c, next) => {
    const start = Date.now();
    const path = new URL(c.req.url).pathname;

    metrics.requests.total++;
    metrics.requests.by_path[path] = (metrics.requests.by_path[path] || 0) + 1;

    try {
      await next();

      const duration = Date.now() - start;
      metrics.response_times.push(duration);

      // Keep only last 1000 response times
      if (metrics.response_times.length > 1000) {
        metrics.response_times.shift();
      }

      const status = c.res.status;
      metrics.requests.by_status[status] = (metrics.requests.by_status[status] || 0) + 1;

      if (status >= 500) {
        metrics.errors++;
      }
    } catch (error) {
      metrics.errors++;
      throw error;
    }
  };

  const getMetrics = () => {
    const avg = metrics.response_times.length > 0
      ? metrics.response_times.reduce((a, b) => a + b, 0) / metrics.response_times.length
      : 0;

    return {
      ...metrics,
      response_time_avg: Math.round(avg),
      response_time_p95: calculateP95(metrics.response_times),
    };
  };

  return { middleware, getMetrics };
};
