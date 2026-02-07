import { describe, expect, it, vi } from 'vitest';

const addHook = vi.fn();
const register = vi.fn();
const setNotFoundHandler = vi.fn();
const listen = vi.fn();
const close = vi.fn();

vi.mock('fastify', () => ({
  default: vi.fn(() => ({
    addHook,
    register,
    setNotFoundHandler,
    listen,
    close,
  })),
}));

vi.mock('@fastify/static', () => ({
  default: vi.fn(),
}));

vi.mock('@fastify/cors', () => ({
  default: vi.fn(),
}));

vi.mock('@fastify/helmet', () => ({
  default: vi.fn(),
}));

vi.mock('node:fs', () => ({
  promises: {
    stat: vi.fn(),
  },
}));

vi.mock('../src/web/routes', () => ({
  registerRoutes: vi.fn(),
}));

vi.mock('../src/web/state', () => ({
  writeUiState: vi.fn(),
  clearUiState: vi.fn(),
}));

vi.mock('../src/core/logger', () => ({
  logger: { info: vi.fn() },
  isDebugEnabled: vi.fn(),
}));

const fsMocks = await import('node:fs');
const routesMocks = await import('../src/web/routes');
const stateMocks = await import('../src/web/state');
const loggerMocks = await import('../src/core/logger');
const { startWebServer } = await import('../src/web/server');

describe('web server', () => {
  it('startWebServer 启动并写入状态', async () => {
    vi.mocked(loggerMocks.isDebugEnabled).mockReturnValue(true);
    vi.mocked(fsMocks.promises.stat as any).mockResolvedValue({});
    listen.mockResolvedValue('http://127.0.0.1:17333');
    const result = await startWebServer(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { basePort: 17333 },
    );
    expect(routesMocks.registerRoutes).toHaveBeenCalled();
    expect(stateMocks.writeUiState).toHaveBeenCalled();
    expect(result.apiUrl).toBe('http://127.0.0.1:17333');
  });

  it('startWebServer 处理端口占用重试', async () => {
    vi.mocked(loggerMocks.isDebugEnabled).mockReturnValue(false);
    vi.mocked(fsMocks.promises.stat as any).mockRejectedValue(new Error('missing'));
    listen
      .mockRejectedValueOnce(Object.assign(new Error('EADDRINUSE'), { code: 'EADDRINUSE' }))
      .mockResolvedValueOnce('http://127.0.0.1:17334');
    const result = await startWebServer(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { basePort: 17333 },
    );
    expect(result.apiPort).toBe(17334);
  });

  it('startWebServer 覆盖 hook、cors 与 notFound', async () => {
    vi.mocked(loggerMocks.isDebugEnabled).mockReturnValue(true);
    vi.mocked(fsMocks.promises.stat as any).mockResolvedValue({});
    listen.mockResolvedValue('http://127.0.0.1:17335');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      return undefined as never;
    }) as any);
    await startWebServer(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { basePort: 17335 },
    );
    const hooks = addHook.mock.calls.map((call) => call[1]);
    const onRequest = hooks[0];
    const onResponse = hooks[1];
    const request = { url: '/api/status', method: 'GET' };
    onRequest(request, {}, () => {});
    onResponse(request, {}, () => {});
    const corsCall = register.mock.calls.find((call) => typeof call[1]?.origin === 'function');
    const originFn = corsCall?.[1]?.origin;
    const callback = vi.fn();
    originFn(null, callback);
    originFn('http://evil.com', callback);
    const notFound = setNotFoundHandler.mock.calls[0]?.[0];
    const reply = { code: vi.fn().mockReturnThis(), send: vi.fn(), sendFile: vi.fn() };
    notFound({ url: '/api/abc' }, reply);
    notFound({ url: '/app' }, reply);
    const sig = process.listeners('SIGTERM')[0] as ((signal: NodeJS.Signals) => void) | undefined;
    await sig?.('SIGTERM');
    exitSpy.mockRestore();
  });

  it('startWebServer 在监听异常时抛出', async () => {
    vi.mocked(loggerMocks.isDebugEnabled).mockReturnValue(false);
    vi.mocked(fsMocks.promises.stat as any).mockResolvedValue({});
    listen.mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
    await expect(
      startWebServer(
        { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
        { basePort: 20000 },
      ),
    ).rejects.toThrow('EACCES');
  });
});
