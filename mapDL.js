const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const mapName = process.argv[2]; // Example: "ChernarusPlus" or "Livonia"
const res = parseInt(process.argv[3], 10); // Resolution (1-8)
const type = process.argv[4]; // Example: "sat" or "top"
const version = process.argv[5]; // Example version, e.g., "1.26.0"

if (!mapName || !res || !type || !version) {
  console.error(
    `Usage: node getmap.js <mapName: ChernarusPlus/Livonia> <res: 1-8> <type: sat/top> <version: e.g., 1.26.0>`
  );
  process.exit(1);
}

// Validate resolution
const tileCount = 2 ** res - 1; // Corrected formula
if (res < 1 || res > 8) {
  console.error(`Resolution must be between 1 and 8.`);
  process.exit(1);
}

// Tile folder path
const outputDir = path.join(__dirname, 'tiles', mapName, type, `res${res}`, version);
fs.mkdirSync(outputDir, { recursive: true });

console.log(`Downloading tiles to ${outputDir}...`);

// Generate tile URLs and file paths
const urls = [];
for (let y = 0; y <= tileCount; y++) {
  for (let x = 0; x <= tileCount; x++) {
    const url = `https://maps.izurvive.com/maps/${mapName}-${type}/${version}/tiles/${res}/${x}/${y}.webp`;
    const outputPath = path.join(outputDir, `${y}_${x}.webp`);
    urls.push({ url, outputPath });
  }
}

// Download Function
const downloadTile = async ({ url, outputPath }) => {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log(`Downloaded: ${outputPath}`);
  } catch (error) {
    console.error(`Failed to download ${url}:`, error.message);
  }
};

// Concurrency Control
const downloadWithConcurrency = async (tasks, concurrency) => {
  const results = [];
  const executing = [];
  for (const task of tasks) {
    const promise = task().then((result) => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    results.push(promise);
    executing.push(promise);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
};

// Create Download Tasks
const tasks = urls.map((tile) => () => downloadTile(tile));

// Run Downloads
(async () => {
  await downloadWithConcurrency(tasks, 10); // Adjust concurrency as needed
  console.log('All tiles downloaded.');
})();
