import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/core/cache', () => ({
  loadCache: vi.fn(),
  buildCache: vi.fn(),
  refreshCache: vi.fn(),
}));

vi.mock('../src/core/preview', () => ({
  buildRepoPreview: vi.fn(),
}));

vi.mock('../src/core/lru', () => ({
  readLru: vi.fn(),
  sortByLru: vi.fn(),
}));

vi.mock('../src/core/plugins', () => ({
  getRegisteredActions: vi.fn(),
}));

vi.mock('../src/plugins/built-in', () => ({
  registerBuiltInPlugins: vi.fn(),
}));

vi.mock('../src/config/config', () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
  getConfigPaths: vi.fn(),
}));

vi.mock('../src/core/tags', async () => {
  const actual = await vi.importActual<typeof import('../src/core/tags')>('../src/core/tags');

  return {
    ...actual,
    readManualTagEdits: vi.fn(),
    updateManualTagEdits: vi.fn(),
    setManualTags: vi.fn(),
  };
});

const cacheMocks = await import('../src/core/cache');
const previewMocks = await import('../src/core/preview');
const lruMocks = await import('../src/core/lru');
const pluginsMocks = await import('../src/core/plugins');
const configMocks = await import('../src/config/config');
const tagMocks = await import('../src/core/tags');
const { registerRoutes } = await import('../src/web/routes');

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
    scanRoots: ['/root'],
  },
  repos: [
    {
      recordId: '/root/a',
      fullPath: '/root/a',
      scanRoot: '/root',
      relativePath: 'a',
      repoKey: 'local:a',
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
      recordId: '/root/b',
      fullPath: '/root/b',
      scanRoot: '/root',
      relativePath: 'b',
      repoKey: 'local:b',
      git: undefined,
      isDirty: true,
      manualTags: [],
      autoTags: [] as string[],
      lastScannedAt: 0,
    },
  ],
};

function createApp() {
  const handlers: Record<string, Function> = {};
  const app = {
    get: (route: string, handler: Function) => {
      handlers[`GET ${route}`] = handler;
    },
    post: (route: string, handler: Function) => {
      handlers[`POST ${route}`] = handler;
    },
  };

  return { app, handlers };
}

describe('web routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(configMocks.getConfigPaths).mockReturnValue({
      configDir: '/cfg',
      dataDir: '/data',
      cacheDir: '/cache',
      configFile: '/cfg/config.json',
      cacheFile: '/cache/cache.json',
      manualTagsFile: '/data/repo_tags.tsv',
      lruFile: '/data/lru.txt',
    });
  });

  it('registerRoutes 基础接口', async () => {
    const { app, handlers } = createApp();
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(null);
    await registerRoutes(
      app as any,
      { scanRoots: ['/root'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { pid: 1, port: 2, url: 'http://x', startedAt: 3 },
    );
    const status = await handlers['GET /api/status']();
    expect(status.cacheFresh).toBe(false);
  });

  it('config 接口支持读取与写入', async () => {
    const { app, handlers } = createApp();
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(baseCache);
    vi.mocked(configMocks.readConfig).mockResolvedValue({
      scanRoots: ['/root'],
      maxDepth: 7,
      pruneDirs: [],
      cacheTtlMs: 1000,
      followSymlinks: false,
    });
    vi.mocked(cacheMocks.refreshCache).mockResolvedValue(baseCache);
    await registerRoutes(
      app as any,
      { scanRoots: ['/root'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { pid: 1, port: 2, url: 'http://x', startedAt: 3 },
    );
    const configPayload = await handlers['GET /api/config']();
    expect(configPayload.paths.configFile).toBe('/cfg/config.json');
    const reply = { code: vi.fn().mockReturnThis() };
    await handlers['POST /api/config']({ body: { config: '{' } }, reply);
    expect(reply.code).toHaveBeenCalledWith(400);
    await handlers['POST /api/config']({ body: { config: 1 } }, reply);
    expect(reply.code).toHaveBeenCalledWith(400);
    await handlers['POST /api/config']({ body: { config: { scanRoots: ['/root'] } } }, reply);
    expect(reply.code).not.toHaveBeenCalledWith(500);
  });

  it('actions 与 repos 接口', async () => {
    const { app, handlers } = createApp();
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(baseCache);
    vi.mocked(tagMocks.readManualTagEdits).mockResolvedValue(
      new Map([['/root/a', { add: ['[manual]'], remove: [] }]]),
    );
    vi.mocked(pluginsMocks.getRegisteredActions).mockReturnValue([
      { id: 'a', label: 'A', run: async () => {}, scopes: ['web'] },
      { id: 'b', label: 'B', run: async () => {}, scopes: ['cli'] },
    ]);
    vi.mocked(lruMocks.readLru).mockResolvedValue(['/root/b', '/root/a']);
    vi.mocked(lruMocks.sortByLru).mockImplementation((repos: any) => repos);
    await registerRoutes(
      app as any,
      { scanRoots: ['/root'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { pid: 1, port: 2, url: 'http://x', startedAt: 3 },
    );
    const actions = await handlers['GET /api/actions']();
    expect(actions.length).toBe(1);
    const reposByName = await handlers['GET /api/repos']({
      query: { sort: 'name', page: '1', pageSize: '1' },
    });
    expect(reposByName.items.length).toBe(1);
    const reposByLru = await handlers['GET /api/repos']({
      query: { sort: 'lru', page: '1', pageSize: '2', tag: 'dirty' },
    });
    expect(reposByLru.items.every((item: any) => item.record.isDirty)).toBe(true);
  });

  it('preview/action/cache/tags 接口', async () => {
    const { app, handlers } = createApp();
    vi.mocked(cacheMocks.loadCache).mockResolvedValue(baseCache);
    vi.mocked(previewMocks.buildRepoPreview).mockResolvedValue({
      data: {
        record: {
          recordId: '/root/a',
          fullPath: '/root/a',
          scanRoot: '/root',
          relativePath: 'a',
          repoKey: 'noremote/root/a',
          git: undefined,
          isDirty: false,
          manualTags: [],
          autoTags: [],
          lastScannedAt: 0,
        },
        repoPath: 'root/a',
        origin: '-',
        siteUrl: '-',
        branch: '-',
        status: 'clean',
        sync: '-',
        recentCommits: [],
        readme: [],
        readmeStatus: 'missing',
        extensions: [],
      },
    });
    vi.mocked(cacheMocks.refreshCache).mockResolvedValue(baseCache);
    const actionRun = vi.fn(async () => {});
    vi.mocked(pluginsMocks.getRegisteredActions).mockReturnValue([
      { id: 'a', label: 'A', run: actionRun, scopes: ['web'] },
    ]);
    await registerRoutes(
      app as any,
      { scanRoots: ['/root'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { pid: 1, port: 2, url: 'http://x', startedAt: 3 },
    );
    const reply = { code: vi.fn().mockReturnThis() };
    await handlers['GET /api/preview']({ query: { path: 'bad' } }, reply);
    expect(reply.code).toHaveBeenCalledWith(400);
    const previewFirst = await handlers['GET /api/preview']({ query: { path: '/root/a' } }, reply);
    const previewSecond = await handlers['GET /api/preview']({ query: { path: '/root/a' } }, reply);
    expect(previewFirst.data.record.fullPath).toBe('/root/a');
    expect(previewSecond.data.record.fullPath).toBe('/root/a');
    await handlers['POST /api/action']({ body: { actionId: 'a', path: '/root/a' } }, reply);
    expect(actionRun).toHaveBeenCalled();
    await handlers['POST /api/cache/refresh']();
    await handlers['POST /api/tags'](
      { body: { path: '/root/a', tags: { add: ['a'], remove: [] } } },
      reply,
    );
    expect(tagMocks.updateManualTagEdits).toHaveBeenCalled();
    await handlers['POST /api/tags'](
      { body: { path: '/root/a', tags: ['a'], refresh: false } },
      reply,
    );
    expect(tagMocks.setManualTags).toHaveBeenCalled();
  });
});
