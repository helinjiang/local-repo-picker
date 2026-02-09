import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/cli/errors', () => ({
  handleFatalError: vi.fn(),
}));

vi.mock('../src/cli/main', () => ({
  runCli: vi.fn(),
}));

const errorMocks = await import('../src/cli/errors');
const mainMocks = await import('../src/cli/main');

describe('cli entry', () => {
  it('cli.ts 注册处理并调用 runCli', async () => {
    await import('../src/cli');
    expect(mainMocks.runCli).toHaveBeenCalled();
  });

  it('cli.ts 处理异常事件', async () => {
    process.emit('unhandledRejection', new Error('boom'), Promise.resolve());
    expect(errorMocks.handleFatalError).toHaveBeenCalled();
  });
});
