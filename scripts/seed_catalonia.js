import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { createContainer } from "../src/core/container.js";
import { createKv } from "../src/adapters/kv/index.js";
import { createIds } from "../src/core/ports/ids.js";
import { createClock } from "../src/core/ports/clock.js";
import { createPlaceRepository } from "../src/contexts/discovery/repository.js";

const run = async () => {
  console.log("🌱 Seeding Catalonia Data...");

  // 1. Setup DI
  const container = createContainer();
  const kv = await createKv();

  container.register('kv', () => kv, 'singleton');
  container.register('ids', createIds, 'singleton');
  container.register('clock', createClock, 'singleton');
  container.register('discovery.repository', createPlaceRepository, 'singleton');

  const repo = container.resolve('discovery.repository');

  // 2. Clear DB
  console.log("🧹 Clearing database...");
  await repo.removeAll();

  // 3. Load Data from YAML
  const yamlContent = await Deno.readTextFile("./seeds/catalonia.yaml");
  const entities = parse(yamlContent);

  // 4. Save to Repo
  console.log(`💾 Saving ${entities.length} places using batching...`);
  await repo.saveAll(entities);

  console.log(`\n✅ Seeded ${entities.length} real places!`);
}

run();
