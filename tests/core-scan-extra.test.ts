import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { scanRepos } from '../src/core/scan';

describe('core scan extra', () => {
  it('scanRepos 找到 git 仓库并生成 autoTag', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-scan-'));
    const repo = path.join(root, 'team', 'repo');
    await fs.mkdir(path.join(repo, '.git'), { recursive: true });
    const found = await scanRepos({ scanRoots: [root], maxDepth: 4 });
    expect(found[0].autoTag).toBe('[team]');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('scanRepos 处理符号链接与告警', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-scan-'));
    const target = path.join(root, 'target');
    await fs.mkdir(target, { recursive: true });
    const link = path.join(root, 'link');
    await fs.symlink(target, link);
    const warnings: string[] = [];
    const found = await scanRepos({
      scanRoots: [root],
      followSymlinks: false,
      onWarning: (w) => warnings.push(w.reason),
    });
    expect(found.length).toBe(0);
    expect(warnings).toContain('symlink_skipped');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('scanRepos 跳过隐藏与 prune 目录', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-scan-'));
    await fs.mkdir(path.join(root, '.hidden'), { recursive: true });
    await fs.mkdir(path.join(root, '_temp'), { recursive: true });
    await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
    const found = await scanRepos({ scanRoots: [root], pruneDirs: ['node_modules'] });
    expect(found.length).toBe(0);
    await fs.rm(root, { recursive: true, force: true });
  });
});
