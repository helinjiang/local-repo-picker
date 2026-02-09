import type { ConfigPaths } from '../types';

export type ConfigTreeNode = {
  title: string;
  key: string;
  path?: string;
  isLeaf?: boolean;
  children?: ConfigTreeNode[];
};

export function buildConfigTree(paths: ConfigPaths | null): ConfigTreeNode[] {
  if (!paths) {
    return [
      {
        title: '加载中',
        key: 'loading',
      },
    ];
  }

  const cacheFiles = [
    { title: 'cache.json', key: 'cache.json', path: paths.cacheFile, isLeaf: true },
  ];
  const dataFiles = [
    { title: 'repo_tags.tsv', key: 'repo_tags.tsv', path: paths.manualTagsFile, isLeaf: true },
    { title: 'lru.txt', key: 'lru.txt', path: paths.lruFile, isLeaf: true },
  ];

  return [
    {
      title: paths.dataDir,
      key: paths.dataDir,
      path: paths.dataDir,
      children: dataFiles,
    },
    {
      title: paths.cacheDir,
      key: paths.cacheDir,
      path: paths.cacheDir,
      children: cacheFiles,
    },
  ];
}
