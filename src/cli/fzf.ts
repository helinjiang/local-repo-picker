import { execa } from 'execa';
import type { Action } from '../core/types';
import { getRegisteredActions } from '../core/plugins';
import { registerBuiltInPlugins } from '../plugins/built-in';
import { logger } from '../core/logger';
import type { CliOptions } from './types';

export async function checkFzfAvailable(): Promise<boolean> {
  try {
    const result = await execa('fzf', ['--version'], {
      stdout: 'ignore',
      stderr: 'ignore',
      reject: false,
    });

    if (result.exitCode === 0) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export async function runFzfPicker(
  options: CliOptions,
  filters: Record<string, string>,
): Promise<string | null> {
  const self = getSelfCli();
  const listResult = await execa(self.file, [...self.argsPrefix, '__list', '--all'], {
    stdout: 'pipe',
    stderr: 'inherit',
    reject: false,
  });

  if (listResult.exitCode !== 0) {
    logger.error('repo __list 执行失败');

    return null;
  }

  const input = listResult.stdout.trimEnd();
  const binds = buildFzfBinds(filters, self.shellPrefix);
  const header = buildFzfHeader(filters);
  const args = [
    '--ansi',
    '--delimiter=\t',
    '--with-nth=1,2,3',
    '--header',
    header,
    '--preview',
    `${self.shellPrefix} __preview --path {4}`,
    '--preview-window=right:60%:wrap',
    '--bind',
    binds,
  ];
  const result = await execa('fzf', args, {
    input,
    stdout: 'pipe',
    stderr: 'inherit',
    reject: false,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const line = result.stdout.trim();

  if (!line) {
    return null;
  }

  const parts = line.split('\t');

  return parts[3]?.trim() || null;
}

export async function runFzfActionPicker(options: CliOptions): Promise<Action | null> {
  registerBuiltInPlugins(options);
  const actions = getRegisteredActions().filter((action) => isActionAllowed(action, 'cli'));

  if (actions.length === 0) {
    return null;
  }

  const input = actions.map((item) => `${item.label}\t${item.id}`).join('\n');
  const result = await execa('fzf', ['--delimiter=\t', '--with-nth=1', '--prompt', 'Action> '], {
    input,
    stdout: 'pipe',
    stderr: 'inherit',
    reject: false,
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const line = result.stdout.trim();

  if (!line) {
    return null;
  }

  const id = line.split('\t')[1];

  return actions.find((item) => item.id === id) ?? null;
}

function isActionAllowed(action: Action, scope: 'cli' | 'web'): boolean {
  if (!action.scopes || action.scopes.length === 0) {
    return true;
  }

  return action.scopes.includes(scope);
}

function buildFzfBinds(filters: Record<string, string>, shellPrefix: string): string {
  const entries = Object.entries(filters);

  if (entries.length === 0) {
    return `ctrl-a:reload(${shellPrefix} __list --all)`;
  }

  const binds = entries.map(([key, tag]) => {
    if (tag === 'all') {
      return `${key}:reload(${shellPrefix} __list --all)`;
    }

    return `${key}:reload(${shellPrefix} __list --filter-tag ${escapeShellArg(tag)})`;
  });

  if (!filters['ctrl-a']) {
    binds.push(`ctrl-a:reload(${shellPrefix} __list --all)`);
  }

  return binds.join(',');
}

function buildFzfHeader(filters: Record<string, string>): string {
  const entries = Object.entries(filters);
  const headerParts = entries.map(([key, tag]) => `${key}=${tag}`);

  if (!filters['ctrl-a']) {
    headerParts.push('ctrl-a=all');
  }

  if (headerParts.length === 0) {
    return '快捷搜索: ctrl-a=all';
  }

  return `快捷搜索: ${headerParts.join(' · ')}`;
}

function escapeShellArg(input: string): string {
  const safe = input.replace(/'/g, "'\"'\"'");

  return `'${safe}'`;
}

function getSelfCli(): { file: string; argsPrefix: string[]; shellPrefix: string } {
  const file = process.execPath;
  const entry = process.argv[1] ?? '';
  const argsPrefix = entry ? [entry] : [];
  const shellPrefix = entry
    ? `${escapeShellArg(file)} ${escapeShellArg(entry)}`
    : escapeShellArg(file);

  return { file, argsPrefix, shellPrefix };
}
