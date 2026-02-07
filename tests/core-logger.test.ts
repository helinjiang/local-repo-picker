import { describe, expect, it, vi } from 'vitest';

describe('core logger', () => {
  it('isDebugEnabled 读取环境变量', async () => {
    const prev = process.env.DEBUG;
    process.env.DEBUG = '1';
    vi.resetModules();
    const loggerModule = await import('../src/core/logger');
    expect(loggerModule.isDebugEnabled()).toBe(true);
    process.env.DEBUG = prev;
  });

  it('logger debug/info 仅在 debug 时输出', async () => {
    const prev = process.env.DEBUG;
    process.env.DEBUG = 'true';
    vi.resetModules();
    const { logger } = await import('../src/core/logger');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('a');
    logger.info('b');
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
    process.env.DEBUG = '';
    vi.resetModules();
    const { logger: logger2 } = await import('../src/core/logger');
    const logSpy2 = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger2.debug('a');
    logger2.info('b');
    expect(logSpy2).not.toHaveBeenCalled();
    logSpy2.mockRestore();
    process.env.DEBUG = prev;
  });

  it('logger warn/error 输出', async () => {
    vi.resetModules();
    const { logger } = await import('../src/core/logger');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.warn('w');
    logger.error('e');
    expect(warnSpy).toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
