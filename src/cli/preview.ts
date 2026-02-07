import path from 'node:path';
import { buildFallbackPreview, buildRepoPreview, type RepoPreviewResult } from '../core/preview';
import type { RepositoryRecord } from '../core/types';
import { logger } from '../core/logger';
import type { CliOptions } from './types';
import { resolveRepoInfo } from './repo';
import { readArgValue } from './utils';

export async function runInternalPreview(options: CliOptions, args: string[]): Promise<void> {
  const rawPath = readArgValue(args, '--path');
  if (!rawPath) {
    logger.error('missing --path');
    process.exitCode = 1;
    return;
  }
  if (!path.isAbsolute(rawPath)) {
    logger.error('path must be absolute');
    process.exitCode = 1;
    return;
  }
  const repoPath = path.resolve(rawPath);
  const repo = await resolveRepoInfo(options, repoPath);
  const result = await buildPreviewWithTimeout(repo, 2000);
  const lines = formatPreviewLines(result);
  console.log(lines.join('\n'));
}

async function buildPreviewWithTimeout(
  repo: RepositoryRecord,
  timeoutMs: number,
): Promise<RepoPreviewResult> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<RepoPreviewResult>((resolve) => {
    timer = setTimeout(() => {
      resolve(buildFallbackPreview(repo.fullPath, 'preview timed out'));
    }, timeoutMs);
  });
  const result = await Promise.race([buildRepoPreview(repo), timeout]);
  if (timer) {
    clearTimeout(timer);
  }
  return result;
}

function formatPreviewLines(result: RepoPreviewResult): string[] {
  const lines: string[] = [];
  if (result.error) {
    lines.push(result.error);
    lines.push('');
  }
  lines.push(`PATH: ${result.data.path}`);
  lines.push(`KEY: ${result.data.repoKey}`);
  lines.push(`ORIGIN: ${result.data.origin}`);
  lines.push(`BRANCH: ${result.data.branch}`);
  lines.push(`STATUS: ${result.data.status}`);
  if (result.data.sync !== '-') {
    lines.push(`SYNC: ${result.data.sync}`);
  }
  lines.push('');
  lines.push('RECENT COMMITS:');
  if (result.data.recentCommits.length > 0) {
    lines.push(...result.data.recentCommits);
  } else {
    lines.push('无提交信息');
  }
  lines.push('');
  lines.push('README:');
  if (result.data.readme.length > 0) {
    lines.push(...result.data.readme.map((line) => (line === '' ? ' ' : line)));
  } else if (result.data.readmeStatus === 'unavailable') {
    lines.push('README unavailable');
  } else {
    lines.push('无 README');
  }
  if (result.data.extensions.length > 0) {
    lines.push('');
    for (const section of result.data.extensions) {
      lines.push(`${section.title}:`);
      if (section.lines.length > 0) {
        lines.push(...section.lines);
      } else {
        lines.push('-');
      }
    }
  }
  return lines;
}
