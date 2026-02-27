import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/logger', () => ({
  isDebugEnabled: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn() },
}));

const loggerMocks = await import('../src/core/logger');
const { formatError, handleFatalError } = await import('../src/cli/errors');
const { readArgValue } = await import('../src/cli/utils');
const { printHelp, readPackageVersion } = await import('../src/cli/help');

describe('cli utils/errors/help', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;
  });

  it('readArgValue 读取参数值', () => {
    expect(readArgValue(['--a', '1'], '--a')).toBe('1');
    expect(readArgValue(['--a'], '--a')).toBe('');
  });

  it('formatError 支持多类型', () => {
    expect(formatError(new Error('boom'))).toBe('boom');
    expect(formatError('bad')).toBe('bad');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatError(circular)).toBe('未知错误');
  });

  it('handleFatalError 设置退出码并输出日志', () => {
    vi.mocked(loggerMocks.isDebugEnabled).mockReturnValue(true);
    const err = new Error('boom');
    err.stack = 'stack';
    handleFatalError(err);
    expect(process.exitCode).toBe(1);
    expect(loggerMocks.logger.error).toHaveBeenCalled();
  });

  it('printHelp 输出帮助信息', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('readPackageVersion 读取 CLI 所在目录的 package.json 版本', async () => {
    const version = await readPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
