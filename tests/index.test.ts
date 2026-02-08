import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/cache', () => ({
  buildCache: vi.fn(),
  loadCache: vi.fn(),
  refreshCache: vi.fn(),
}));

const cacheMocks = await import('../src/core/cache');
const pickRepoModule = await import('../src/index');

describe('index pickRepo', () => {
  it('pickRepo refresh 分支', async () => {
    vi.mocked(cacheMocks.refreshCache).mockResolvedValue({
      savedAt: 1,
      ttlMs: 1,
      metadata: {
        cacheVersion: 1,
        scanStartedAt: 0,
        scanFinishedAt: 0,
        scanDurationMs: 0,
        buildDurationMs: 0,
        repoCount: 1,
        scanRoots: ['/'],
      },
      repos: [
        {
          recordId: '/a',
          fullPath: '/a',
          scanRoot: '/',
          relativePath: 'a',
          repoKey: 'local:a',
          git: undefined,
          isDirty: false,
          manualTags: [],
          autoTags: [],
          lastScannedAt: 0,
        },
      ],
    });
    const repos = await pickRepoModule.default({ scanRoots: ['/'], refresh: true });
    expect(repos.length).toBe(1);
  });

  it('pickRepo 使用缓存或构建缓存', async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue({
      savedAt: 1,
      ttlMs: 1,
      metadata: {
        cacheVersion: 1,
        scanStartedAt: 0,
        scanFinishedAt: 0,
        scanDurationMs: 0,
        buildDurationMs: 0,
        repoCount: 1,
        scanRoots: ['/'],
      },
      repos: [
        {
          recordId: '/a',
          fullPath: '/a',
          scanRoot: '/',
          relativePath: 'a',
          repoKey: 'local:a',
          git: undefined,
          isDirty: false,
          manualTags: [],
          autoTags: [],
          lastScannedAt: 0,
        },
      ],
    });
    const cached = await pickRepoModule.default({ scanRoots: ['/'] });
    expect(cached.length).toBe(1);
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(null);
    vi.mocked(cacheMocks.buildCache).mockResolvedValue({
      savedAt: 1,
      ttlMs: 1,
      metadata: {
        cacheVersion: 1,
        scanStartedAt: 0,
        scanFinishedAt: 0,
        scanDurationMs: 0,
        buildDurationMs: 0,
        repoCount: 1,
        scanRoots: ['/'],
      },
      repos: [
        {
          recordId: '/b',
          fullPath: '/b',
          scanRoot: '/',
          relativePath: 'b',
          repoKey: 'local:b',
          git: undefined,
          isDirty: false,
          manualTags: [],
          autoTags: [],
          lastScannedAt: 0,
        },
      ],
    });
    const built = await pickRepoModule.default({ scanRoots: ['/'] });
    expect(built[0].fullPath).toBe('/b');
  });

  it('index 导出存在', () => {
    expect(typeof pickRepoModule.buildCache).toBe('function');
    expect(typeof pickRepoModule.readConfig).toBe('function');
  });
});
