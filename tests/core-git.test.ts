import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/command', () => ({
  runCommand: vi.fn(),
}));

vi.mock('../src/core/logger', () => ({
  logger: { debug: vi.fn() },
  isDebugEnabled: vi.fn(),
}));

const commandMocks = await import('../src/core/command');
const loggerMocks = await import('../src/core/logger');
const { resolveGitDir, runGit, checkGitAvailable, readOriginUrl, parseOriginInfo, isDirty } =
  await import('../src/core/git');

describe('core git', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveGitDir 支持目录与文件指向', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-git-'));
    const dirPath = path.join(root, '.git');
    await fs.mkdir(dirPath, { recursive: true });
    expect(await resolveGitDir(root)).toBe(dirPath);
    await fs.rm(dirPath, { recursive: true, force: true });
    const refFile = path.join(root, '.git');
    await fs.writeFile(refFile, 'gitdir: .git/modules/x', 'utf8');
    expect(await resolveGitDir(root)).toBe(path.resolve(root, '.git/modules/x'));
    await fs.writeFile(refFile, 'invalid', 'utf8');
    expect(await resolveGitDir(root)).toBeNull();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('runGit 校验命令与处理失败', async () => {
    const blocked = await runGit([]);
    expect(blocked.ok).toBe(false);
    vi.mocked(commandMocks.runCommand).mockResolvedValueOnce({ stdout: '', stderr: '' });
    const ok = await runGit(['status', '--porcelain'], { cwd: '/tmp' });
    expect(ok.ok).toBe(true);
    vi.mocked(commandMocks.runCommand).mockRejectedValueOnce(
      Object.assign(new Error('not a git repository'), { code: 'ENOENT' }),
    );
    vi.mocked(loggerMocks.isDebugEnabled).mockReturnValue(true);
    const failed = await runGit(['--version']);
    expect(failed.ok).toBe(false);
  });

  it('runGit 解析超时与未知错误', async () => {
    vi.mocked(commandMocks.runCommand).mockRejectedValueOnce(
      Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }),
    );
    const timeout = await runGit(['--version']);
    expect(timeout.ok).toBe(false);
    vi.mocked(commandMocks.runCommand).mockRejectedValueOnce(new Error('unknown'));
    const unknown = await runGit(['--version']);
    expect(unknown.ok).toBe(false);
  });

  it('checkGitAvailable 使用缓存', async () => {
    vi.mocked(commandMocks.runCommand).mockResolvedValue({ stdout: 'git 2.0', stderr: '' });
    const first = await checkGitAvailable();
    const second = await checkGitAvailable();
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it('readOriginUrl 解析 config', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-origin-'));
    const gitDir = path.join(root, '.git');
    await fs.mkdir(gitDir, { recursive: true });
    await fs.writeFile(
      path.join(gitDir, 'config'),
      `[remote "origin"]\n  url = https://github.com/a/b.git\n`,
      'utf8',
    );
    expect(await readOriginUrl(root)).toBe('https://github.com/a/b.git');
    await fs.writeFile(path.join(gitDir, 'config'), 'bad', 'utf8');
    expect(await readOriginUrl(root)).toBeNull();
    await fs.rm(root, { recursive: true, force: true });
  });

  it('parseOriginInfo 支持 http 与 scp', () => {
    expect(parseOriginInfo('https://github.com/a/b.git').fullName).toBe('a/b');
    expect(parseOriginInfo('git@github.com:a/b.git').host).toBe('github.com');
    expect(parseOriginInfo('bad').fullName).toBe('');
  });

  it('isDirty 根据 git status 输出判断', async () => {
    vi.mocked(commandMocks.runCommand).mockResolvedValueOnce({ stdout: '', stderr: '' });
    const clean = await isDirty('/tmp');
    expect(clean).toBe(false);
    vi.mocked(commandMocks.runCommand).mockResolvedValueOnce({ stdout: ' M a', stderr: '' });
    const dirty = await isDirty('/tmp');
    expect(dirty).toBe(true);
  });
});
