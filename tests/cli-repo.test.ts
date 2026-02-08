import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/cache', () => ({
  loadCache: vi.fn(),
}));

const cacheMocks = await import('../src/core/cache');
const { resolveRepoInfo } = await import('../src/cli/repo');

describe('cli repo', () => {
  it('resolveRepoInfo 命中缓存', async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue({
      savedAt: Date.now(),
      ttlMs: 1000,
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
    const repo = await resolveRepoInfo(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      '/a',
    );
    expect(repo.fullPath).toBe('/a');
  });

  it('resolveRepoInfo 未命中缓存时返回默认结构', async () => {
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(null);
    const repo = await resolveRepoInfo(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      '/b',
    );
    expect(repo.fullPath).toBe('/b');
    expect(repo.manualTags).toEqual([]);
  });
});
