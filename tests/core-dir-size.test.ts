import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/command', () => ({
  runCommand: vi.fn(),
}));

describe('core dir-size', () => {
  it('统计目录大小与合并 node_modules 大小', async () => {
    const commandMocks = await import('../src/core/command');
    vi.mocked(commandMocks.runCommand).mockRejectedValue(new Error('du not available'));
    const { measureRepoSizes } = await import('../src/core/dir-size');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-dir-size-'));
    const repo = path.join(root, 'repo');
    await fs.mkdir(repo, { recursive: true });

    await fs.writeFile(path.join(repo, 'a.txt'), Buffer.alloc(10));
    await fs.mkdir(path.join(repo, 'sub'), { recursive: true });
    await fs.writeFile(path.join(repo, 'sub', 'b.txt'), Buffer.alloc(20));

    await fs.mkdir(path.join(repo, 'node_modules', 'pkg-a'), { recursive: true });
    await fs.writeFile(path.join(repo, 'node_modules', 'pkg-a', 'c.txt'), Buffer.alloc(100));

    await fs.mkdir(path.join(repo, 'sub', 'node_modules', 'pkg-b'), { recursive: true });
    await fs.writeFile(path.join(repo, 'sub', 'node_modules', 'pkg-b', 'd.txt'), Buffer.alloc(50));

    const sizes = await measureRepoSizes(repo);
    expect(sizes.folderSizeBytes).toBe(10 + 20 + 100 + 50);
    expect(sizes.nodeModulesSizeBytes).toBe(100 + 50);

    await fs.rm(root, { recursive: true, force: true });
  });
});
