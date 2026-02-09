import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCache } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cacheDir = path.join(__dirname, '.cache');

const cache = await buildCache({
  scanRoots: [root],
  maxDepth: 3,
  pruneDirs: ['node_modules', 'dist'],
  cacheFile: path.join(cacheDir, 'cache.json'),
  manualTagsFile: path.join(cacheDir, 'repo_tags.tsv'),
  lruFile: path.join(cacheDir, 'lru.txt'),
});

console.log(JSON.stringify(cache.repos.slice(0, 10), null, 2));
