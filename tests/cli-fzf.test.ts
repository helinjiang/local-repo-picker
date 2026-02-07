import { describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('../src/core/plugins', () => ({
  getRegisteredActions: vi.fn(),
}));

vi.mock('../src/plugins/built-in', () => ({
  registerBuiltInPlugins: vi.fn(),
}));

const execaMocks = await import('execa');
const pluginsMocks = await import('../src/core/plugins');
const { runFzfPicker, runFzfActionPicker, checkFzfAvailable } = await import('../src/cli/fzf');

describe('cli fzf', () => {
  it('checkFzfAvailable 在成功时返回 true', async () => {
    (execaMocks.execa as any).mockResolvedValue({ exitCode: 0 });
    expect(await checkFzfAvailable()).toBe(true);
  });

  it('checkFzfAvailable 在失败时返回 false', async () => {
    (execaMocks.execa as any).mockResolvedValue({ exitCode: 1 });
    expect(await checkFzfAvailable()).toBe(false);
  });

  it('runFzfPicker 解析选中路径', async () => {
    (execaMocks.execa as any).mockImplementation(async (command: any, args: any) => {
      if (command === 'repo') {
        return { exitCode: 0, stdout: 'a\t/path\t[tag]' };
      }

      if (command === 'fzf') {
        return { exitCode: 0, stdout: 'a\t/selected\t[tag]' };
      }

      return { exitCode: 1, stdout: '' };
    });
    const selected = await runFzfPicker(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { 'ctrl-a': 'all' },
    );
    expect(selected).toBe('/selected');
  });

  it('runFzfPicker 处理失败与空选项', async () => {
    (execaMocks.execa as any).mockResolvedValueOnce({ exitCode: 1, stdout: '' });
    const failed = await runFzfPicker(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      { 'ctrl-a': 'all' },
    );
    expect(failed).toBeNull();
    (execaMocks.execa as any).mockResolvedValueOnce({ exitCode: 0, stdout: 'a\t/path\t[tag]' });
    (execaMocks.execa as any).mockResolvedValueOnce({ exitCode: 0, stdout: '' });
    const empty = await runFzfPicker(
      { scanRoots: ['/'], cacheFile: '', manualTagsFile: '', lruFile: '' },
      {},
    );
    expect(empty).toBeNull();
  });

  it('runFzfActionPicker 根据选择返回 action', async () => {
    vi.mocked(pluginsMocks.getRegisteredActions).mockReturnValue([
      { id: 'a', label: 'Action A', run: async () => {}, scopes: ['cli'] },
      { id: 'b', label: 'Action B', run: async () => {}, scopes: ['web'] },
    ]);
    (execaMocks.execa as any).mockResolvedValue({
      exitCode: 0,
      stdout: 'Action A\ta',
    });
    const action = await runFzfActionPicker({
      scanRoots: ['/'],
      cacheFile: '',
      manualTagsFile: '',
      lruFile: '',
    });
    expect(action?.id).toBe('a');
  });

  it('runFzfActionPicker 无 action 或取消', async () => {
    vi.mocked(pluginsMocks.getRegisteredActions).mockReturnValue([]);
    const none = await runFzfActionPicker({
      scanRoots: ['/'],
      cacheFile: '',
      manualTagsFile: '',
      lruFile: '',
    });
    expect(none).toBeNull();
    vi.mocked(pluginsMocks.getRegisteredActions).mockReturnValue([
      { id: 'a', label: 'Action A', run: async () => {}, scopes: ['cli'] },
    ]);
    (execaMocks.execa as any).mockResolvedValue({ exitCode: 130, stdout: '' });
    const canceled = await runFzfActionPicker({
      scanRoots: ['/'],
      cacheFile: '',
      manualTagsFile: '',
      lruFile: '',
    });
    expect(canceled).toBeNull();
  });
});
