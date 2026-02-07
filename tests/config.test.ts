import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string | null = null;
const prevEnv = process.env.LOCAL_REPO_PICKER_DIR;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-config-'));
  process.env.LOCAL_REPO_PICKER_DIR = tempDir;
  vi.resetModules();
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  tempDir = null;
  if (prevEnv === undefined) {
    delete process.env.LOCAL_REPO_PICKER_DIR;
  } else {
    process.env.LOCAL_REPO_PICKER_DIR = prevEnv;
  }
});

describe('config', () => {
  it('确保配置文件存在并应用默认值', async () => {
    const { ensureConfigFile, readConfig, getConfigPaths } = await import('../src/config/config');
    const configFile = await ensureConfigFile();
    const stat = await fs.stat(configFile);
    expect(stat.isFile()).toBe(true);
    await fs.writeFile(
      configFile,
      JSON.stringify({
        scanRoots: ['/tmp/workspace'],
      }),
      'utf8',
    );
    const config = await readConfig();
    expect(config.scanRoots).toEqual(['/tmp/workspace']);
    expect(config.maxDepth).toBe(7);
    expect(config.pruneDirs).toEqual([]);
    expect(config.cacheTtlMs).toBe(12 * 60 * 60 * 1000);
    expect(config.followSymlinks).toBe(false);
    const paths = getConfigPaths();
    expect(path.dirname(paths.configFile)).toContain('config');
  });

  it('remoteHostProviders 应保持原样', async () => {
    const { ensureConfigFile, readConfig } = await import('../src/config/config');
    const configFile = await ensureConfigFile();
    await fs.writeFile(
      configFile,
      JSON.stringify({
        scanRoots: ['/tmp/workspace'],
        remoteHostProviders: {
          'code.youdomain.org': 'youdomain',
          'code.demo.org': '[demo]',
        },
      }),
      'utf8',
    );
    const config = await readConfig();
    expect(config.remoteHostProviders).toEqual({
      'code.youdomain.org': 'youdomain',
      'code.demo.org': 'demo',
    });
  });
});
