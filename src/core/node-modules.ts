import path from 'node:path';
import { promises as fs } from 'node:fs';
import { logger } from './logger';

export async function findNodeModulesDirs(root: string): Promise<string[]> {
  const dirs: string[] = [];
  const stack: string[] = [root];

  while (stack.length) {
    const dirPath = stack.pop();

    if (!dirPath) {
      break;
    }

    let entries: Array<{
      name: string;
      isDirectory: () => boolean;
      isSymbolicLink: () => boolean;
    }>;

    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        continue;
      }

      const entryPath = path.join(dirPath, entry.name);

      if (entry.name === 'node_modules') {
        dirs.push(entryPath);

        continue;
      }

      stack.push(entryPath);
    }
  }

  return dirs;
}

export async function clearNodeModules(repoPath: string): Promise<{
  found: number;
  removed: number;
  failed: number;
}> {
  const dirs = await findNodeModulesDirs(repoPath);
  let removed = 0;
  let failed = 0;

  for (const dir of dirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      removed += 1;
    } catch (error) {
      failed += 1;
      logger.debug(`clear node_modules failed: ${dir}`, error);
    }
  }

  return { found: dirs.length, removed, failed };
}
