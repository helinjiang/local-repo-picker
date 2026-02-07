import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { readConfig, writeConfig } from '../config/config';

export async function runSetupWizard(configFile: string) {
  if (!process.stdin.isTTY) {
    return null;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('首次运行向导');
  console.log(`配置文件: ${configFile}`);
  const defaultRoot = path.join(os.homedir(), 'workspace');
  const scanRoots = await promptScanRoots(rl, defaultRoot);

  if (scanRoots.length === 0) {
    rl.close();

    return null;
  }

  const maxDepth = await promptNumber(rl, 'maxDepth', 7);
  const pruneDirs = await promptList(rl, 'pruneDirs（逗号分隔，可留空）');
  const followSymlinks = await promptYesNo(rl, 'followSymlinks（y/N）', false);
  rl.close();
  await writeConfig({ scanRoots, maxDepth, pruneDirs, followSymlinks });

  return await readConfig();
}

async function promptScanRoots(rl: readline.Interface, defaultRoot: string): Promise<string[]> {
  while (true) {
    const raw = (await rl.question(`请输入 scanRoots（逗号分隔，默认: ${defaultRoot}）: `)).trim();
    const candidates = (raw ? raw.split(',') : [defaultRoot])
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => expandPath(item))
      .map((item) => path.resolve(item));
    const { valid, invalid } = await splitValidPaths(candidates);

    if (invalid.length > 0) {
      console.log(`以下路径无效或不可访问: ${invalid.join(', ')}`);
    }

    if (valid.length > 0) {
      return valid;
    }

    console.log('至少需要一个有效的 scanRoot');
  }
}

async function promptNumber(
  rl: readline.Interface,
  label: string,
  defaultValue: number,
): Promise<number> {
  while (true) {
    const raw = (await rl.question(`${label}（默认: ${defaultValue}）: `)).trim();

    if (!raw) {
      return defaultValue;
    }

    const value = Number(raw);

    if (Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    console.log('请输入有效数字');
  }
}

async function promptList(rl: readline.Interface, label: string): Promise<string[]> {
  const raw = (await rl.question(`${label}: `)).trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function promptYesNo(
  rl: readline.Interface,
  label: string,
  defaultValue: boolean,
): Promise<boolean> {
  const raw = (await rl.question(`${label}: `)).trim().toLowerCase();

  if (!raw) {
    return defaultValue;
  }

  return raw === 'y' || raw === 'yes';
}

async function splitValidPaths(paths: string[]): Promise<{
  valid: string[];
  invalid: string[];
}> {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const item of paths) {
    try {
      const stat = await fs.stat(item);

      if (stat.isDirectory()) {
        valid.push(item);
      } else {
        invalid.push(item);
      }
    } catch {
      invalid.push(item);
    }
  }

  return { valid, invalid };
}

function expandPath(input: string): string {
  if (input.startsWith('~')) {
    return path.join(os.homedir(), input.slice(1));
  }

  return input;
}
