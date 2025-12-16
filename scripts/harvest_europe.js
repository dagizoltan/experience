import { harvestRegion } from "./harvest_osm.js";

const REGIONS = [
  "Andorra",
  "Portugal",
  // "Spain", // Commented out to save time during demo, but easy to enable
  // "France",
  // "Italy"
];

const run = async () => {
  console.log("🚀 Starting Europe Harvest Batch...");

  for (const region of REGIONS) {
    console.log(`\n-----------------------------------`);
    console.log(`PROCESSING: ${region}`);

    const outputPath = `seeds/europe/${region.toLowerCase()}.yaml`;
    await harvestRegion(region, outputPath);

    // Politeness delay to avoid hitting rate limits too hard
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n✅ Europe Harvest Batch Complete!`);
};

run();
