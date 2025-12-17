import { parse } from "https://deno.land/std@0.224.0/yaml/mod.ts";
import { expandGlob } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { createContainer } from "../src/core/container.js";
import { createKv } from "../src/adapters/kv/index.js";
import { createIds } from "../src/core/ports/ids.js";
import { createClock } from "../src/core/ports/clock.js";
import { createPlaceRepository } from "../src/contexts/discovery/repository.js";

const run = async () => {
  console.log("🌱 Seeding Database from Harvested YAMLs...");

  // 1. Setup DI
  const container = createContainer();
  const kv = await createKv();

  container.register('kv', () => kv, 'singleton');
  container.register('ids', createIds, 'singleton');
  container.register('clock', createClock, 'singleton');
  container.register('discovery.repository', createPlaceRepository, 'singleton');

  const repo = container.resolve('discovery.repository');

  // 2. Clear DB (Optional logic - user can comment out if they want to append)
  console.log("🧹 Clearing database...");
  await repo.removeAll();

  // 3. Read and Seed Files
  let totalSeeded = 0;

  for await (const entry of expandGlob("seeds/europe/*.yaml")) {
    console.log(`\n📄 Processing: ${entry.name}`);
    try {
      const yamlContent = await Deno.readTextFile(entry.path);
      const entities = parse(yamlContent);

      if (entities && entities.length > 0) {
        console.log(`   💾 Saving ${entities.length} items...`);
        await repo.saveAll(entities);
        totalSeeded += entities.length;
      } else {
        console.log(`   ⚠️ Empty or invalid file.`);
      }
    } catch (err) {
      console.error(`   ❌ Error processing file: ${err.message}`);
    }
  }

  console.log(`\n✅ Seeding Complete! Total items: ${totalSeeded}`);
};

run();
