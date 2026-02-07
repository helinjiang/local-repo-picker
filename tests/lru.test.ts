import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { readLru, updateLru } from '../src/core/lru';
import { normalizeRepoKey } from '../src/core/path-utils';

describe('lru', () => {
  it('归一化路径后去重', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-lru-'));
    const repoPath = path.join(root, 'repo');
    await fs.mkdir(repoPath, { recursive: true });
    const lruFile = path.join(root, 'lru.txt');
    const pathWithSegments = path.join(repoPath, '..', 'repo');
    await fs.writeFile(lruFile, `${pathWithSegments}\n`, 'utf8');
    const updated = await updateLru(lruFile, repoPath, 10);
    expect(updated).toEqual([normalizeRepoKey(repoPath)]);
    const loaded = await readLru(lruFile);
    expect(loaded).toEqual([normalizeRepoKey(repoPath)]);
    await fs.rm(root, { recursive: true, force: true });
  });
});
