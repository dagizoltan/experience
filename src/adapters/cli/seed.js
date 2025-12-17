
// src/adapters/cli/seed.js
import { createContainer } from "../../core/container.js";
import { createKv } from "../../adapters/kv/index.js";
import { createIds } from "../../core/ports/ids.js";
import { createClock } from "../../core/ports/clock.js";
import { createPlaceRepository } from "../../contexts/discovery/repository.js";
import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { expandGlob } from "https://deno.land/std@0.224.0/fs/mod.ts";

const run = async () => {
  console.log("🌱 Seeding Europe Data from Harvested YAMLs...");

  // 1. Setup DI
  const container = createContainer();
  const kv = await createKv();

  container.register('kv', () => kv, 'singleton');
  container.register('ids', createIds, 'singleton');
  container.register('clock', createClock, 'singleton');
  container.register('discovery.repository', createPlaceRepository, 'singleton');

  const repo = container.resolve('discovery.repository');

  // 2. Clear DB (Optional, or just overwrite)
  console.log("🧹 Clearing database...");
  await repo.removeAll();

  // 3. Load Files
  const glob = expandGlob("./seeds/europe/*.yaml");
  let totalCount = 0;

  for await (const file of glob) {
    console.log(`\n📂 Loading ${file.name}...`);
    try {
      const content = await Deno.readTextFile(file.path);
      const features = parse(content);

      if (!Array.isArray(features) || features.length === 0) {
        console.log("  ⚠️ Empty or invalid file.");
        continue;
      }

      console.log(`  💾 Saving ${features.length} places...`);
      await repo.saveAll(features);
      totalCount += features.length;
    } catch (err) {
      console.error(`  ❌ Failed to process ${file.name}:`, err.message);
    }
  }

  console.log(`\n✅ Seeded total of ${totalCount} places!`);
}

run();
