import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCache } from '../src/core/cache';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  createdDirs.length = 0;
});

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-cache-'));
  createdDirs.push(dir);
  return dir;
}

describe('cache', () => {
  it('缓存损坏时自动删除并返回 null', async () => {
    const root = await makeTempDir();
    const cacheFile = path.join(root, 'cache.json');
    const manualTagsFile = path.join(root, 'repo_tags.tsv');
    const lruFile = path.join(root, 'lru.txt');
    await fs.writeFile(cacheFile, '{invalid json', 'utf8');
    const result = await loadCache({
      scanRoots: [],
      cacheFile,
      manualTagsFile,
      lruFile,
    });
    expect(result).toBeNull();
    const exists = await fs.access(cacheFile).then(
      () => true,
      () => false,
    );
    expect(exists).toBe(false);
  });
});
