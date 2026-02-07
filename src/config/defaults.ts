import type { AppConfig } from './schema';

export const defaultConfig: AppConfig = {
  scanRoots: [],
  maxDepth: 7,
  pruneDirs: [],
  cacheTtlMs: 12 * 60 * 60 * 1000,
  followSymlinks: false,
  webQuickTags: [],
  webRepoLinks: {},
  remoteHostProviders: {},
  fzfTagFilters: {
    'ctrl-b': '[byted]',
    'ctrl-g': '[github]',
    'ctrl-e': '[gitee]',
    'ctrl-d': '[dirty]',
    'ctrl-a': 'all',
  },
};
