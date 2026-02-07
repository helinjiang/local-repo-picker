import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPlugins,
  getRegisteredActions,
  registerPlugins,
  resolvePreviewExtensions,
  resolveTagExtensions,
} from '../src/core/plugins';
import type { PluginModule, RepositoryRecord, RepoPreview } from '../src/core/types';

afterEach(() => {
  clearPlugins();
});

describe('plugins', () => {
  it('tag 插件失败不影响主流程', async () => {
    const plugins: PluginModule[] = [
      {
        id: 'ok',
        label: 'ok',
        tags: [
          {
            id: 'ok-tag',
            label: 'ok',
            apply: async () => ['custom'],
          },
        ],
      },
      {
        id: 'bad',
        label: 'bad',
        tags: [
          {
            id: 'bad-tag',
            label: 'bad',
            apply: async () => {
              throw new Error('boom');
            },
          },
        ],
      },
    ];
    registerPlugins(plugins);
    const tags = await resolveTagExtensions({
      repoPath: '/tmp/repo',
      scanRoot: '/tmp',
      fullName: 'repo',
      provider: 'github',
      autoTags: [],
      manualTags: [],
      dirty: false,
      baseTags: [],
    });
    expect(tags).toEqual(['[custom]']);
  });

  it('preview 插件失败不影响主流程', async () => {
    const plugins: PluginModule[] = [
      {
        id: 'ok-preview',
        label: 'ok-preview',
        previews: [
          {
            id: 'ok-preview',
            label: 'ok-preview',
            render: async () => ({
              title: 'TEST',
              lines: ['ok'],
            }),
          },
        ],
      },
      {
        id: 'bad-preview',
        label: 'bad-preview',
        previews: [
          {
            id: 'bad-preview',
            label: 'bad-preview',
            render: async () => {
              throw new Error('boom');
            },
          },
        ],
      },
    ];
    registerPlugins(plugins);
    const repo: RepositoryRecord = {
      fullPath: '/tmp/repo',
      scanRoot: '/tmp',
      relativePath: 'repo',
      recordKey: 'local:repo',
      git: undefined,
      isDirty: false,
      manualTags: [],
      autoTags: [],
      lastScannedAt: Date.now(),
    };
    const preview: RepoPreview = {
      path: repo.fullPath,
      repoPath: 'repo',
      repoKey: 'local:repo',
      origin: '-',
      siteUrl: '-',
      branch: '-',
      status: 'clean',
      sync: '-',
      recentCommits: [],
      readme: [],
      readmeStatus: 'missing',
      extensions: [],
    };
    const sections = await resolvePreviewExtensions({ repo, preview });
    expect(sections).toEqual([{ title: 'TEST', lines: ['ok'] }]);
  });

  it('action 注册可被读取', () => {
    const plugins: PluginModule[] = [
      {
        id: 'action',
        label: 'action',
        actions: [
          {
            id: 'print',
            label: 'print',
            run: async () => {},
          },
        ],
      },
    ];
    registerPlugins(plugins);
    const actions = getRegisteredActions();
    expect(actions.map((action) => action.id)).toEqual(['print']);
  });
});
