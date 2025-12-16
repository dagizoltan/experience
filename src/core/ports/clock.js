
// src/core/ports/clock.js

export const createClock = () => ({
  now: () => Date.now(),
  toISO: (ms) => new Date(ms).toISOString(),
  fromISO: (iso) => new Date(iso).getTime(),
})
