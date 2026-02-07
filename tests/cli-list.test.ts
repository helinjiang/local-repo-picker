import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/cache', () => ({
  loadCache: vi.fn(),
  buildCache: vi.fn(),
}));

vi.mock('../src/core/lru', () => ({
  readLru: vi.fn(),
  sortByLru: vi.fn(),
}));

vi.mock('../src/cli/fzf', () => ({
  checkFzfAvailable: vi.fn(),
  runFzfPicker: vi.fn(),
  runFzfActionPicker: vi.fn(),
}));

vi.mock('../src/cli/repo', () => ({
  resolveRepoInfo: vi.fn(),
}));

vi.mock('../src/core/logger', () => ({
  logger: { error: vi.fn() },
}));

const cacheMocks = await import('../src/core/cache');
const lruMocks = await import('../src/core/lru');
const fzfMocks = await import('../src/cli/fzf');
const repoMocks = await import('../src/cli/repo');
const loggerMocks = await import('../src/core/logger');
const { runListCommand, runInternalList } = await import('../src/cli/list');

const baseCache = {
  savedAt: Date.now(),
  ttlMs: 1000,
  metadata: {
    cacheVersion: 1,
    scanStartedAt: 0,
    scanFinishedAt: 0,
    scanDurationMs: 0,
    buildDurationMs: 0,
    repoCount: 2,
    scanRoots: ['/'],
  },
  repos: [
    {
      fullPath: '/a',
      scanRoot: '/',
      relativePath: 'a',
      recordKey: 'local:a',
      git: {
        provider: 'github' as const,
        namespace: 'b',
        repo: 'a',
        fullName: 'b/a',
        baseUrl: 'https://github.com',
        originUrl: 'https://github.com/b/a.git',
        isValid: true,
      },
      isDirty: false,
      manualTags: ['[x]'],
      autoTags: [] as string[],
      lastScannedAt: 0,
    },
    {
      fullPath: '/b',
      scanRoot: '/',
      relativePath: 'b',
      recordKey: 'local:b',
      git: undefined,
      isDirty: true,
      manualTags: [],
      autoTags: [] as string[],
      lastScannedAt: 0,
    },
  ],
};

describe('cli list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;
  });

  it('runListCommand 在缓存缺失时返回错误', async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(null);
    await runListCommand({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      'list',
    ]);
    expect(loggerMocks.logger.error).toHaveBeenCalled();
  });

  it('runListCommand 在 fzf 分支执行 action', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(baseCache);
    vi.mocked(fzfMocks.checkFzfAvailable).mockResolvedValue(true);
    vi.mocked(fzfMocks.runFzfPicker).mockResolvedValue('/a');
    vi.mocked(repoMocks.resolveRepoInfo).mockResolvedValue(baseCache.repos[0]);
    const run = vi.fn(async () => {});
    vi.mocked(fzfMocks.runFzfActionPicker).mockResolvedValue({ id: 'a', label: 'a', run });
    await runListCommand({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      'list',
    ]);
    expect(run).toHaveBeenCalled();
  });

  it('runListCommand 输出 json 与 tsv', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    vi.mocked(cacheMocks.loadCache).mockResolvedValueOnce(baseCache);
    vi.mocked(lruMocks.sortByLru).mockImplementation((repos: any) => repos);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runListCommand({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      'list',
      '--json',
    ]);
    vi.mocked(cacheMocks.loadCache).mockResolvedValueOnce(baseCache);
    vi.mocked(lruMocks.sortByLru).mockImplementation((repos: any) => repos);
    await runListCommand({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      'list',
      '--tsv',
    ]);
    logSpy.mockRestore();
  });

  it('runListCommand 支持 name 与 lru 排序', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(baseCache);
    vi.mocked(lruMocks.readLru).mockResolvedValue(['/b', '/a']);
    vi.mocked(lruMocks.sortByLru).mockReturnValue(baseCache.repos.slice().reverse());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runListCommand({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      'list',
      '--sort',
      'name',
    ]);
    await runListCommand({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      'list',
      '--sort',
      'lru',
    ]);
    logSpy.mockRestore();
  });

  it('runListCommand 对非法排序返回错误', async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(baseCache);
    await runListCommand({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      'list',
      '--sort',
      'bad',
    ]);
    expect(loggerMocks.logger.error).toHaveBeenCalled();
  });

  it('runInternalList 可输出缓存或重建缓存', async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(null);
    vi.mocked(cacheMocks.buildCache).mockResolvedValue(baseCache);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runInternalList({ scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' }, [
      '__list',
      '--filter-tag',
      'dirty',
    ]);
    logSpy.mockRestore();
  });
});
