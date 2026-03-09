import path from 'node:path';
import { promises as fs } from 'node:fs';
import { runCommand } from './command';
import { logger } from './logger';
import { findNodeModulesDirs } from './node-modules';

export async function measureRepoSizes(repoPath: string): Promise<{
  folderSizeBytes: number;
  nodeModulesSizeBytes: number;
}> {
  const viaDu = await tryMeasureRepoSizesViaDu(repoPath);

  if (viaDu) {
    return viaDu;
  }

  return measureRepoSizesViaFs(repoPath);
}

async function tryMeasureRepoSizesViaDu(repoPath: string): Promise<{
  folderSizeBytes: number;
  nodeModulesSizeBytes: number;
} | null> {
  try {
    const folderSizeBytes = await duBytes(repoPath);
    const nodeModulesDirs = await findNodeModulesDirs(repoPath);
    let nodeModulesSizeBytes = 0;

    for (const dir of nodeModulesDirs) {
      nodeModulesSizeBytes += await duBytes(dir);
    }

    return { folderSizeBytes, nodeModulesSizeBytes };
  } catch (error) {
    logger.debug('dir-size du unavailable or failed, fallback to fs traversal', error);

    return null;
  }
}

async function duBytes(targetPath: string): Promise<number> {
  const result = await runCommand('du', ['-sk', targetPath], { timeoutMs: 10_000 });
  const trimmed = result.stdout.trim();
  const match = trimmed.match(/^(\d+)\s+/);

  if (!match) {
    throw new Error(`unexpected du output: ${trimmed}`);
  }

  const kiloBytes = Number.parseInt(match[1], 10);

  if (!Number.isFinite(kiloBytes) || kiloBytes < 0) {
    throw new Error(`invalid du size: ${match[1]}`);
  }

  return kiloBytes * 1024;
}

async function measureRepoSizesViaFs(repoPath: string): Promise<{
  folderSizeBytes: number;
  nodeModulesSizeBytes: number;
}> {
  const stack: Array<{ dirPath: string; inNodeModules: boolean }> = [
    { dirPath: repoPath, inNodeModules: false },
  ];
  let folderSizeBytes = 0;
  let nodeModulesSizeBytes = 0;

  while (stack.length) {
    const current = stack.pop();

    if (!current) {
      break;
    }

    let entries: Array<{
      name: string;
      isDirectory: () => boolean;
      isFile: () => boolean;
      isSymbolicLink: () => boolean;
    }>;

    try {
      entries = await fs.readdir(current.dirPath, { withFileTypes: true });
    } catch (error) {
      logger.debug(`dir-size readdir failed: ${current.dirPath}`, error);

      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const entryPath = path.join(current.dirPath, entry.name);

      if (entry.isFile()) {
        try {
          const stat = await fs.stat(entryPath);
          folderSizeBytes += stat.size;

          if (current.inNodeModules) {
            nodeModulesSizeBytes += stat.size;
          }
        } catch (error) {
          logger.debug(`dir-size stat failed: ${entryPath}`, error);
        }

        continue;
      }

      if (entry.isDirectory()) {
        const nextInNodeModules = current.inNodeModules || entry.name === 'node_modules';
        stack.push({ dirPath: entryPath, inNodeModules: nextInNodeModules });
      }
    }
  }

  return { folderSizeBytes, nodeModulesSizeBytes };
}
