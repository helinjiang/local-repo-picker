import envPaths from 'env-paths';

export type AppPaths = {
  configDir: string;
  dataDir: string;
  cacheDir: string;
};

export function getPaths(): AppPaths {
  const paths = envPaths('local-repo-picker');

  return {
    configDir: paths.config,
    dataDir: paths.data,
    cacheDir: paths.cache,
  };
}
