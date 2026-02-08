import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/git', () => ({
  readOriginUrl: vi.fn(),
  runGit: vi.fn(),
  checkGitAvailable: vi.fn(),
  isDirty: vi.fn(),
  resolveGitDir: vi.fn(),
  parseOriginInfo: vi.fn(() => ({ host: 'github.com', ownerRepo: 'a/b' })),
}));

vi.mock('../src/core/plugins', () => ({
  resolvePreviewExtensions: vi.fn(async () => []),
}));

const gitMocks = await import('../src/core/git');
const pluginMocks = await import('../src/core/plugins');
const { readOriginValue, parseOriginToSiteUrl } = await import('../src/core/origin');
const { buildRepoPreview, buildFallbackPreview } = await import('../src/core/preview');
const { runCommand } = await import('../src/core/command');

describe('core origin/preview/command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('readOriginValue 优先读取 config', async () => {
    vi.mocked(gitMocks.readOriginUrl).mockResolvedValue('git@github.com:a/b.git');
    const value = await readOriginValue('/tmp/repo');
    expect(value).toBe('git@github.com:a/b.git');
    expect(gitMocks.runGit).not.toHaveBeenCalled();
  });

  it('readOriginValue 回退到 runGit', async () => {
    vi.mocked(gitMocks.readOriginUrl).mockResolvedValue(null);
    vi.mocked(gitMocks.runGit).mockResolvedValue({
      ok: true,
      stdout: 'https://github.com/a/b.git\n',
    });
    const value = await readOriginValue('/tmp/repo');
    expect(value).toBe('https://github.com/a/b.git');
  });

  it('parseOriginToSiteUrl 支持 http 与 scp', () => {
    expect(parseOriginToSiteUrl('https://github.com/a/b.git')).toBe('https://github.com/a/b');
    expect(parseOriginToSiteUrl('git@github.com:a/b.git')).toBe('https://github.com/a/b');
    expect(parseOriginToSiteUrl('invalid')).toBeNull();
  });

  it('buildRepoPreview 读取不到仓库路径时降级', async () => {
    const preview = await buildRepoPreview({
      recordId: '/non-exists',
      fullPath: '/non-exists',
      scanRoot: '/',
      relativePath: 'non-exists',
      repoKey: 'local:non-exists',
      git: undefined,
      isDirty: false,
      manualTags: [],
      autoTags: [],
      lastScannedAt: 0,
    });
    expect(preview.error).toBe('Repository not accessible');
  });

  it('buildRepoPreview 在非 git 目录时返回降级', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-preview-'));
    await fs.writeFile(path.join(root, 'README.md'), 'hello\nworld\n', 'utf8');
    vi.mocked(gitMocks.resolveGitDir).mockResolvedValue(null);
    const preview = await buildRepoPreview({
      recordId: root,
      fullPath: root,
      scanRoot: '/',
      relativePath: 'a/b',
      repoKey: 'local:a/b',
      git: undefined,
      isDirty: false,
      manualTags: [],
      autoTags: [],
      lastScannedAt: 0,
    });
    expect(preview.data.readmeStatus).toBe('ok');
    expect(preview.error).toBe('Repository not accessible');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('buildRepoPreview 在 git 不可用时降级', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-preview-'));
    vi.mocked(gitMocks.resolveGitDir).mockResolvedValue(path.join(root, '.git'));
    vi.mocked(gitMocks.checkGitAvailable).mockResolvedValue(false);
    const preview = await buildRepoPreview({
      recordId: root,
      fullPath: root,
      scanRoot: '/',
      relativePath: 'a/b',
      repoKey: 'local:a/b',
      git: undefined,
      isDirty: false,
      manualTags: [],
      autoTags: [],
      lastScannedAt: 0,
    });
    expect(preview.error).toBe('Git not available');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('buildRepoPreview 在完整 git 信息时输出预览', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-preview-'));
    await fs.writeFile(path.join(root, 'README.md'), 'hello', 'utf8');
    vi.mocked(gitMocks.resolveGitDir).mockResolvedValue(path.join(root, '.git'));
    vi.mocked(gitMocks.checkGitAvailable).mockResolvedValue(true);
    vi.mocked(gitMocks.readOriginUrl).mockResolvedValue('https://github.com/a/b.git');
    vi.mocked(gitMocks.isDirty).mockResolvedValue(true);
    vi.mocked(pluginMocks.resolvePreviewExtensions).mockResolvedValue([
      { title: 'EXT', lines: ['ok'] },
    ]);
    vi.mocked(gitMocks.runGit).mockImplementation(async (args) => {
      if (args[0] === 'rev-parse') {
        return { ok: true, stdout: 'main' };
      }

      if (args[0] === 'rev-list') {
        return { ok: true, stdout: '1 2' };
      }

      if (args[0] === 'log') {
        return { ok: true, stdout: '2020-01-01 abc msg' };
      }

      return { ok: true, stdout: 'https://github.com/a/b.git' };
    });
    const preview = await buildRepoPreview({
      recordId: root,
      fullPath: root,
      scanRoot: '/',
      relativePath: 'a/b',
      repoKey: 'local:a/b',
      git: undefined,
      isDirty: false,
      manualTags: [],
      autoTags: [],
      lastScannedAt: 0,
    });
    expect(preview.data.status).toBe('dirty');
    expect(preview.data.siteUrl).toBe('https://github.com/a/b');
    expect(preview.data.repoPath).toBe('a/b');
    expect(preview.data.record.repoKey).toBe('github:a/b');
    expect(preview.data.extensions.length).toBe(1);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('buildFallbackPreview 返回默认结构', () => {
    const fallback = buildFallbackPreview('/tmp/a', 'boom');
    expect(fallback.data.origin).toBe('-');
    expect(fallback.data.repoPath).toBe('tmp/a');
    expect(fallback.data.record.repoKey).toBe('local:tmp/a');
    expect(fallback.error).toBe('boom');
  });

  it('runCommand 执行命令并处理异常参数', async () => {
    const result = await runCommand('node', ['-e', "console.log('ok')"]);
    expect(result.stdout.trim()).toBe('ok');
    await expect(runCommand('', [])).rejects.toThrow('command required');
    await expect(runCommand('bad\0', [])).rejects.toThrow('invalid command');
    await expect(runCommand('node', ['a\0'])).rejects.toThrow('invalid argument');
    await expect(runCommand('node', ['-e', "console.log('ok')"], { cwd: '\0' })).rejects.toThrow(
      'invalid path',
    );
  });
});
