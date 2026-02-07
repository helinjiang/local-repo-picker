import path from 'node:path';
import { loadCache } from '../core/cache';
import { normalizeRepoKey } from '../core/path-utils';
import type { RepositoryRecord } from '../core/types';
import { buildRepositoryRecord, deriveRelativePath } from '../core/domain';
import type { CliOptions } from './types';

export async function resolveRepoInfo(
  options: CliOptions,
  repoPath: string,
): Promise<RepositoryRecord> {
  const cached = await loadCache(options);
  const targetKey = normalizeRepoKey(repoPath);
  const found = cached?.repos.find((repo) => normalizeRepoKey(repo.fullPath) === targetKey);
  if (found) {
    return found;
  }
  const resolvedPath = path.resolve(repoPath);
  const scanRoot = options.scanRoots[0] ?? path.dirname(resolvedPath);
  return buildRepositoryRecord({
    fullPath: resolvedPath,
    scanRoot,
    relativePath: deriveRelativePath(resolvedPath, scanRoot),
    git: undefined,
    isDirty: false,
    manualTags: [],
    autoTags: [],
    lastScannedAt: Date.now(),
  });
}
