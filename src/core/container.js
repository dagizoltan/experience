
// src/core/container.js

/**
 * Dependency Injection Container
 * ADR-001: Auto-resolve Container with Destructured Dependencies
 */
export const createContainer = () => {
  const registry = new Map()
  const cache = new Map()

  const register = (name, factory, lifecycle = 'transient') => {
    registry.set(name, { factory, lifecycle })
  }

  const resolve = (name) => {
    // 1. Check registry
    const registration = registry.get(name)
    if (!registration) {
      throw new Error(`Service not registered: ${name}`)
    }

    // 2. Check cache (Singletons)
    if (registration.lifecycle === 'singleton' && cache.has(name)) {
      return cache.get(name)
    }

    // 3. Resolve dependencies
    // We use a regex to parse the factory function arguments
    // expecting ({ dep1, dep2 }) pattern
    const factoryStr = registration.factory.toString()
    const match = factoryStr.match(/(\(\s*\{[^}]+\}\s*\)|[^)]+)/)

    const dependencies = {}

    if (match) {
      const args = match[0].replace(/[({})\s]/g, '').split(',')

      for (const arg of args) {
        if (arg && arg.length > 0) {
          // Recursive resolution
          // Convention: dependency name matches registered name
          // e.g., 'kv' -> resolve('kv')
          // 'discovery_repository' -> resolve('discovery.repository')
          const lookupName = arg.includes('_') ? arg.replace('_', '.') : arg
          try {
             dependencies[arg] = resolve(lookupName)
          } catch (e) {
             // If not found, maybe it's passed at runtime?
             // Ideally we strictly resolve everything.
             console.warn(`Could not auto-resolve dependency: ${lookupName}`)
          }
        }
      }
    }

    // 4. Instantiate
    const instance = registration.factory(dependencies)

    // 5. Cache if singleton
    if (registration.lifecycle === 'singleton') {
      cache.set(name, instance)
    }

    return instance
  }

  return { register, resolve }
}
