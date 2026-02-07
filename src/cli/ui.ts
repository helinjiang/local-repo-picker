import net from 'node:net';
import { spawn } from 'node:child_process';
import { execa } from 'execa';
import type { ConfigPaths } from '../config/config';
import { getConfigPaths } from '../config/config';
import { logger } from '../core/logger';
import { startWebServer } from '../web/server';
import type { UiState } from '../web/state';
import { clearUiState, isProcessAlive, readUiState } from '../web/state';
import type { CliOptions } from './types';
import { formatError } from './errors';
import { checkFzfAvailable } from './fzf';
import { readArgValue } from './utils';

export type UiFlags = { port?: number; noOpen: boolean; dev: boolean };

export async function runStatus(args: string[]): Promise<void> {
  const useJson = args.includes('--json');
  const paths = getConfigPaths();
  const fzfAvailable = await checkFzfAvailable();
  const state = await readUiState();

  if (!state) {
    if (useJson) {
      console.log(
        JSON.stringify({
          running: false,
          fzfAvailable,
          paths,
        }),
      );
    } else {
      console.log('UI not running, run `repo ui`');
      console.log(`fzf: ${fzfAvailable ? 'available' : 'missing'}`);
      printConfigPaths(paths);
    }

    process.exitCode = 1;

    return;
  }

  if (!isProcessAlive(state.pid)) {
    await clearUiState();

    if (useJson) {
      console.log(
        JSON.stringify({
          running: false,
          crashed: true,
          fzfAvailable,
          paths,
          lastUrl: state.url,
          lastPid: state.pid,
          startedAt: state.startedAt,
        }),
      );
    } else {
      console.log('UI not running, run `repo ui` (last run crashed)');
      console.log(`fzf: ${fzfAvailable ? 'available' : 'missing'}`);
      printConfigPaths(paths);
    }

    process.exitCode = 1;

    return;
  }

  if (useJson) {
    console.log(
      JSON.stringify({
        running: true,
        fzfAvailable,
        paths,
        url: state.url,
        pid: state.pid,
        port: state.port,
        startedAt: state.startedAt,
      }),
    );

    return;
  }

  console.log(state.url);
  console.log(`fzf: ${fzfAvailable ? 'available' : 'missing'}`);
  printConfigPaths(paths);
}

export async function runUiCommand(args: string[]): Promise<void> {
  const subcommand = args[1];

  if (subcommand === 'stop') {
    await stopUiServer({ allowMissing: false });

    return;
  }

  if (subcommand === 'restart') {
    await stopUiServer({ allowMissing: true });
    const restartArgs = ['ui', ...args.slice(2)];
    let uiFlags: UiFlags;

    try {
      uiFlags = parseUiFlags(restartArgs);
    } catch (error) {
      logger.error(formatError(error));
      process.exitCode = 1;

      return;
    }

    await startUiInBackground(args.slice(2));
    const startedState = await waitForUiState(8000);

    if (!startedState) {
      logger.error('启动 Web UI 失败');
      process.exitCode = 1;

      return;
    }

    console.log(startedState.url);

    if (!uiFlags.noOpen) {
      await openBrowserOnMac(startedState.url);
    }

    return;
  }

  let uiFlags: UiFlags;

  try {
    uiFlags = parseUiFlags(args);
  } catch (error) {
    logger.error(formatError(error));
    process.exitCode = 1;

    return;
  }

  const state = await readUiState();

  if (state && isProcessAlive(state.pid)) {
    console.log(state.url);

    return;
  }

  await startUiInBackground(args.slice(1));
  const startedState = await waitForUiState(8000);

  if (!startedState) {
    logger.error('启动 Web UI 失败');
    process.exitCode = 1;

    return;
  }

  console.log(startedState.url);

  if (!uiFlags.noOpen) {
    await openBrowserOnMac(startedState.url);
  }
}

export function parseUiFlags(args: string[]): UiFlags {
  const noOpen = args.includes('--no-open');
  const dev = args.includes('--dev');
  const rawPort = readArgValue(args, '--port');

  if (!rawPort) {
    return { noOpen, dev };
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`无效端口: ${rawPort}`);
  }

  return { noOpen, dev, port };
}

export async function runUiServer(
  options: CliOptions,
  flags: UiFlags,
): Promise<{ url: string; port: number }> {
  if (flags.dev) {
    const uiPort = await findAvailablePort(flags.port ?? 5173, 30);
    const uiUrl = `http://127.0.0.1:${uiPort}`;
    const server = await startWebServer(options, { basePort: 17333, uiPort, uiUrl });
    await startViteDevServer(uiPort, server.apiUrl);

    return { url: uiUrl, port: uiPort };
  }

  const basePort = flags.port ?? 17333;
  const server = await startWebServer(options, { basePort });

  return { url: server.url, port: server.port };
}

function printConfigPaths(paths: ConfigPaths): void {
  console.log('paths:');
  console.log(`  configFile: ${paths.configFile}`);
  console.log(`  cacheFile: ${paths.cacheFile}`);
  console.log(`  manualTagsFile: ${paths.manualTagsFile}`);
  console.log(`  lruFile: ${paths.lruFile}`);
  console.log(`  configDir: ${paths.configDir}`);
  console.log(`  dataDir: ${paths.dataDir}`);
  console.log(`  cacheDir: ${paths.cacheDir}`);
}

async function stopUiServer(options: { allowMissing: boolean }): Promise<void> {
  const state = await readUiState();

  if (!state) {
    if (!options.allowMissing) {
      console.log('UI not running, run `repo ui`');
      process.exitCode = 1;
    }

    return;
  }

  if (!isProcessAlive(state.pid)) {
    await clearUiState();

    if (!options.allowMissing) {
      console.log('UI not running, run `repo ui` (last run crashed)');
      process.exitCode = 1;
    }

    return;
  }

  try {
    process.kill(state.pid, 'SIGTERM');
  } catch (error) {
    logger.error(formatError(error));
    process.exitCode = 1;

    return;
  }

  const stopped = await waitForProcessExit(state.pid, 4000);

  if (!stopped) {
    try {
      process.kill(state.pid, 'SIGKILL');
    } catch (error) {
      logger.error(formatError(error));
      process.exitCode = 1;

      return;
    }

    const forced = await waitForProcessExit(state.pid, 2000);

    if (!forced) {
      logger.error('无法停止 Web UI 进程');
      process.exitCode = 1;

      return;
    }
  }

  await clearUiState();
  console.log('Web UI stopped');
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true;
    }

    await delay(200);
  }

  return false;
}

async function waitForUiState(timeoutMs: number): Promise<UiState | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = await readUiState();

    if (state && isProcessAlive(state.pid)) {
      return state;
    }

    await delay(200);
  }

  return null;
}

async function startUiInBackground(args: string[]): Promise<void> {
  const cliPath = process.argv[1];
  const childArgs = [cliPath, '__ui-serve', ...args];
  const child = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startViteDevServer(port: number, apiUrl: string): Promise<void> {
  const child = execa(
    'npm',
    [
      '--prefix',
      'webapp',
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      env: {
        ...process.env,
        VITE_API_BASE: `${apiUrl}/api`,
      },
      stdio: 'ignore',
      reject: false,
    },
  );
  child.catch(() => {});
}

async function findAvailablePort(basePort: number, attempts: number): Promise<number> {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = basePort + offset;
    const available = await isPortAvailable(port);

    if (available) {
      return port;
    }
  }

  throw new Error(`未找到可用端口: ${basePort}-${basePort + attempts - 1}`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function openBrowserOnMac(url: string): Promise<void> {
  if (process.platform !== 'darwin') {
    return;
  }

  try {
    await execa('open', [url], { stdio: 'ignore', reject: false });
  } catch {
    return;
  }
}
