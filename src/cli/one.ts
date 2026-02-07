import path from 'node:path';
import { runGit } from '../core/git';
import { logger } from '../core/logger';
import type { CliOptions } from './types';
import { checkFzfAvailable, runFzfActionPicker } from './fzf';
import { resolveRepoInfo } from './repo';

export async function runOneCommand(options: CliOptions): Promise<void> {
  if (!process.stdout.isTTY) {
    logger.error('repo one 仅支持交互式终端');
    process.exitCode = 1;
    return;
  }
  const hasFzf = await checkFzfAvailable();
  if (!hasFzf) {
    logger.error('未检测到 fzf（终端交互使用），安装：brew install fzf');
    process.exitCode = 1;
    return;
  }
  const result = await runGit(['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
  if (!result.ok) {
    logger.error('当前目录不是 git 仓库');
    process.exitCode = 1;
    return;
  }
  const repoPath = path.resolve(result.stdout.trim());
  const repo = await resolveRepoInfo(options, repoPath);
  const action = await runFzfActionPicker(options);
  if (!action) {
    return;
  }
  await action.run(repo);
}
