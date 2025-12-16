
// src/adapters/kv/index.js

export const createKv = async (path) => {
  // Ensure we share the same DB file locally
  const dbPath = path || './data.db';
  return await Deno.openKv();
}
