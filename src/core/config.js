
// src/core/config.js

export const createConfig = () => {
  const env = Deno.env.toObject()

  const get = (key, defaultValue) => {
    return env[key] || defaultValue
  }

  return { get }
}
