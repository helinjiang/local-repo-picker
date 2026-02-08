import { promises as fs } from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';
import { isDebugEnabled, logger } from './logger';
import { runCommand } from './command';

const gitLimit = pLimit(6);
const defaultTimeoutMs = 2000;
let gitAvailableCache: boolean | null = null;

export type GitErrorKind = 'not_found' | 'not_repo' | 'timeout' | 'unknown' | 'not_allowed';

export type GitResult =
  | { ok: true; stdout: string }
  | { ok: false; kind: GitErrorKind; message: string };

export async function resolveGitDir(repoPath: string): Promise<string | null> {
  const normalizedRepoPath = path.resolve(repoPath);
  const dotGitPath = path.join(normalizedRepoPath, '.git');

  try {
    const stat = await fs.stat(dotGitPath);

    if (stat.isDirectory()) {
      return dotGitPath;
    }

    if (stat.isFile()) {
      const content = await fs.readFile(dotGitPath, 'utf8');
      const match = content.match(/gitdir:\s*(.+)\s*$/m);

      if (!match) {
        return null;
      }

      const gitdir = match[1].trim();

      if (path.isAbsolute(gitdir)) {
        return gitdir;
      }

      return path.resolve(normalizedRepoPath, gitdir);
    }
  } catch {
    return null;
  }

  return null;
}

export async function runGit(
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<GitResult> {
  const allowed = validateGitArgs(args);

  if (!allowed.ok) {
    return { ok: false, kind: 'not_allowed', message: allowed.message };
  }

  const normalizedCwd = options.cwd ? path.resolve(options.cwd) : undefined;
  const gitArgs = normalizedCwd ? ['-C', normalizedCwd, ...args] : args;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const start = Date.now();

  try {
    const { stdout } = await gitLimit(() => runCommand('git', gitArgs, { timeoutMs }));

    if (isDebugEnabled()) {
      logger.debug(`git ${gitArgs.join(' ')} ${Date.now() - start}ms`);
    }

    return { ok: true, stdout };
  } catch (error) {
    const kind = parseGitError(error);
    const message = getGitErrorMessage(kind, error);

    if (isDebugEnabled()) {
      logger.debug(`git ${gitArgs.join(' ')} failed ${Date.now() - start}ms ${message}`);
    }

    return { ok: false, kind, message };
  }
}

export async function checkGitAvailable(): Promise<boolean> {
  if (gitAvailableCache !== null) {
    return gitAvailableCache;
  }

  const result = await runGit(['--version']);
  gitAvailableCache = result.ok;

  return gitAvailableCache;
}

export async function readOriginUrl(repoPath: string): Promise<string | null> {
  const normalizedRepoPath = path.resolve(repoPath);
  const gitDir = await resolveGitDir(normalizedRepoPath);

  if (!gitDir) {
    return null;
  }

  const configPath = path.join(gitDir, 'config');

  try {
    const content = await fs.readFile(configPath, 'utf8');
    const lines = content.split(/\r?\n/);
    let inOrigin = false;

    for (const line of lines) {
      const sectionMatch = line.match(/^\s*\[(.+?)\]\s*$/);

      if (sectionMatch) {
        inOrigin = sectionMatch[1] === 'remote "origin"';
        continue;
      }

      if (!inOrigin) {
        continue;
      }

      const urlMatch = line.match(/^\s*url\s*=\s*(.+)\s*$/);

      if (urlMatch) {
        return urlMatch[1].trim();
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function parseOriginInfo(originUrl: string | null): {
  host?: string;
  fullName: string;
} {
  if (!originUrl) {
    return { fullName: '' };
  }

  let host: string | undefined;
  let repoPath = '';

  if (originUrl.includes('://')) {
    try {
      const url = new URL(originUrl);
      host = url.hostname;
      repoPath = url.pathname;
    } catch {
      return { fullName: '' };
    }
  } else {
    const scpMatch = originUrl.match(/^(?:.+@)?([^:]+):(.+)$/);

    if (scpMatch) {
      host = scpMatch[1];
      repoPath = scpMatch[2];
    } else {
      return { fullName: '' };
    }
  }

  const trimmed = repoPath.replace(/^\//, '').replace(/\.git$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  let fullName = trimmed;

  if (parts.length >= 2) {
    fullName = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }

  return { host, fullName };
}

export async function isDirty(repoPath: string, timeoutMs?: number): Promise<boolean> {
  const normalizedRepoPath = path.resolve(repoPath);
  const result = await runGit(['status', '--porcelain'], { cwd: normalizedRepoPath, timeoutMs });

  if (!result.ok) {
    return false;
  }

  return result.stdout.trim().length > 0;
}

function validateGitArgs(args: string[]): { ok: true } | { ok: false; message: string } {
  if (args.length === 0) {
    return { ok: false, message: 'git command not allowed' };
  }

  const [cmd, ...rest] = args;

  if (cmd.startsWith('-')) {
    if (cmd === '--version' && rest.length === 0) {
      return { ok: true };
    }

    return { ok: false, message: 'git command not allowed' };
  }

  if (cmd === 'status') {
    return rest.length === 1 && rest[0] === '--porcelain'
      ? { ok: true }
      : { ok: false, message: 'git command not allowed' };
  }

  if (cmd === 'config') {
    return rest.length === 2 && rest[0] === '--get' && rest[1] === 'remote.origin.url'
      ? { ok: true }
      : { ok: false, message: 'git command not allowed' };
  }

  if (cmd === 'rev-parse') {
    if (rest.length === 2 && rest[0] === '--abbrev-ref' && rest[1] === 'HEAD') {
      return { ok: true };
    }

    if (rest.length === 1 && rest[0] === '--show-toplevel') {
      return { ok: true };
    }

    return { ok: false, message: 'git command not allowed' };
  }

  if (cmd === 'rev-list') {
    return rest.length === 3 &&
      rest[0] === '--left-right' &&
      rest[1] === '--count' &&
      rest[2] === 'HEAD...@{upstream}'
      ? { ok: true }
      : { ok: false, message: 'git command not allowed' };
  }

  if (cmd === 'log') {
    return rest.length === 4 &&
      rest[0] === '-n' &&
      rest[1] === '12' &&
      rest[2] === '--date=iso' &&
      rest[3] === '--pretty=format:%cd %h %s'
      ? { ok: true }
      : { ok: false, message: 'git command not allowed' };
  }

  return { ok: false, message: 'git command not allowed' };
}

function parseGitError(error: unknown): GitErrorKind {
  const err = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };

  if (err?.code === 'ENOENT') {
    return 'not_found';
  }

  if (err?.code === 'ETIMEDOUT') {
    return 'timeout';
  }

  const message = `${err?.stderr ?? ''}\n${err?.message ?? ''}`.toLowerCase();

  if (message.includes('timed out')) {
    return 'timeout';
  }

  if (message.includes('not a git repository')) {
    return 'not_repo';
  }

  return 'unknown';
}

function getGitErrorMessage(kind: GitErrorKind, error: unknown): string {
  if (kind === 'not_found') {
    return 'git not found';
  }

  if (kind === 'not_repo') {
    return 'not a git repository';
  }

  if (kind === 'timeout') {
    return 'git timeout';
  }

  const err = error as NodeJS.ErrnoException;

  return err?.message ?? 'git failed';
}
