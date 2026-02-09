import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FoundRepo, ScanOptions, ScanWarning } from './types';
import { logger } from './logger';

const defaultMaxDepth = 7;

export async function scanRepos(options: ScanOptions): Promise<FoundRepo[]> {
  const scanRoots = options.scanRoots.map((root) => path.resolve(root));
  const maxDepth = options.maxDepth ?? defaultMaxDepth;
  const pruneDirs = new Set(options.pruneDirs ?? []);
  const followSymlinks = options.followSymlinks ?? false;
  const onWarning = options.onWarning;
  const results: FoundRepo[] = [];

  for (const root of scanRoots) {
    const rootStat = await resolveRootStat(root, followSymlinks, onWarning);

    if (!rootStat) {
      continue;
    }

    await walkRoot(root, root, 0, maxDepth, pruneDirs, results, followSymlinks, onWarning);
  }

  return results;
}

async function walkRoot(
  root: string,
  current: string,
  depth: number,
  maxDepth: number,
  pruneDirs: Set<string>,
  results: FoundRepo[],
  followSymlinks: boolean,
  onWarning?: (warning: ScanWarning) => void,
): Promise<void> {
  if (depth > maxDepth) {
    return;
  }

  let entries;

  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch (error) {
    recordWarning(onWarning, {
      path: current,
      reason: mapFsErrorReason(error, 'readdir_failed'),
    });

    return;
  }

  const hasGit = entries.some((entry) => entry.name === '.git');

  if (hasGit) {
    const autoTag = getAutoTag(root, current);
    results.push({ path: current, scanRoot: root, autoTag });

    return;
  }

  for (const entry of entries) {
    if (entry.name === '.git') {
      continue;
    }

    if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
      continue;
    }

    if (pruneDirs.has(entry.name)) {
      continue;
    }

    const next = path.join(current, entry.name);

    if (entry.isSymbolicLink()) {
      if (!followSymlinks) {
        recordWarning(onWarning, { path: next, reason: 'symlink_skipped' });
        continue;
      }

      const statResult = await safeStat(next);

      if (!statResult.stat) {
        recordWarning(onWarning, {
          path: next,
          reason: statResult.reason ?? 'not_found',
        });
        continue;
      }

      if (!statResult.stat.isDirectory()) {
        recordWarning(onWarning, { path: next, reason: 'not_directory' });
        continue;
      }

      await walkRoot(
        root,
        next,
        depth + 1,
        maxDepth,
        pruneDirs,
        results,
        followSymlinks,
        onWarning,
      );
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    await walkRoot(root, next, depth + 1, maxDepth, pruneDirs, results, followSymlinks, onWarning);
  }
}

function getAutoTag(scanRoot: string, repoPath: string): string | undefined {
  const rel = path.relative(scanRoot, repoPath);

  if (!rel || rel === '') {
    return undefined;
  }

  const first = rel.split(path.sep).filter(Boolean)[0];

  if (!first) {
    return undefined;
  }

  return `[${first}]`;
}

async function resolveRootStat(
  root: string,
  followSymlinks: boolean,
  onWarning?: (warning: ScanWarning) => void,
): Promise<import('node:fs').Stats | null> {
  let stat;

  try {
    stat = await fs.lstat(root);
  } catch (error) {
    recordWarning(onWarning, {
      path: root,
      reason: mapFsErrorReason(error, 'not_found'),
    });

    return null;
  }

  if (stat.isSymbolicLink()) {
    if (!followSymlinks) {
      recordWarning(onWarning, { path: root, reason: 'symlink_skipped' });

      return null;
    }

    const linked = await safeStat(root);

    if (!linked.stat) {
      recordWarning(onWarning, {
        path: root,
        reason: linked.reason ?? 'not_found',
      });

      return null;
    }

    stat = linked.stat;
  }

  if (!stat.isDirectory()) {
    recordWarning(onWarning, { path: root, reason: 'not_directory' });

    return null;
  }

  return stat;
}

async function safeStat(
  target: string,
): Promise<{ stat: import('node:fs').Stats | null; reason?: ScanWarning['reason'] }> {
  try {
    return { stat: await fs.stat(target) };
  } catch (error) {
    return { stat: null, reason: mapFsErrorReason(error, 'not_found') };
  }
}

function recordWarning(
  onWarning: ((warning: ScanWarning) => void) | undefined,
  warning: ScanWarning,
): void {
  onWarning?.(warning);
  logger.debug(`scan skip: ${warning.reason} ${warning.path}`);
}

function mapFsErrorReason(error: unknown, fallback: ScanWarning['reason']): ScanWarning['reason'] {
  const err = error as NodeJS.ErrnoException;

  if (err?.code === 'EACCES' || err?.code === 'EPERM') {
    return 'no_permission';
  }

  if (err?.code === 'ENOENT') {
    return 'not_found';
  }

  return fallback;
}
