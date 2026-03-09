import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { clearNodeModules, findNodeModulesDirs } from '../src/core/node-modules';

describe('core node-modules', () => {
  it('查找并清理所有 node_modules', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-node-modules-'));
    const repo = path.join(root, 'repo');
    await fs.mkdir(repo, { recursive: true });

    await fs.mkdir(path.join(repo, 'node_modules', 'a'), { recursive: true });
    await fs.writeFile(path.join(repo, 'node_modules', 'a', 'x.txt'), 'x');

    await fs.mkdir(path.join(repo, 'sub', 'node_modules', 'b'), { recursive: true });
    await fs.writeFile(path.join(repo, 'sub', 'node_modules', 'b', 'y.txt'), 'y');

    const found = await findNodeModulesDirs(repo);
    expect(found.length).toBe(2);

    const result = await clearNodeModules(repo);
    expect(result.found).toBe(2);
    expect(result.removed).toBe(2);
    expect(result.failed).toBe(0);

    await expect(fs.stat(path.join(repo, 'node_modules'))).rejects.toBeTruthy();
    await expect(fs.stat(path.join(repo, 'sub', 'node_modules'))).rejects.toBeTruthy();

    await fs.rm(root, { recursive: true, force: true });
  });
});
