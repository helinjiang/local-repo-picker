import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { UiState } from './state';
import { clearUiState, writeUiState } from './state';
import { registerRoutes } from './routes';
import { isDebugEnabled, logger } from '../core/logger';

type ServerOptions = {
  scanRoots: string[];
  maxDepth?: number;
  pruneDirs?: string[];
  cacheTtlMs?: number;
  followSymlinks?: boolean;
  remoteHostProviders?: Record<string, string>;
  cacheFile: string;
  manualTagsFile: string;
  lruFile: string;
};

type StartWebServerConfig = {
  basePort?: number;
  uiUrl?: string;
  uiPort?: number;
};

export async function startWebServer(
  options: ServerOptions,
  config: StartWebServerConfig = {},
): Promise<UiState & { apiUrl: string; apiPort: number }> {
  const debugEnabled = isDebugEnabled();
  const app = fastify({ logger: false });

  if (debugEnabled) {
    app.addHook('onRequest', (request, _reply, done) => {
      (request as { startAt?: number }).startAt = Date.now();
      done();
    });
    app.addHook('onResponse', (request, _reply, done) => {
      const startedAt = (request as { startAt?: number }).startAt;

      if (typeof startedAt === 'number' && request.url.startsWith('/api/')) {
        const cost = Date.now() - startedAt;
        logger.info(`api ${request.method} ${request.url} ${cost}ms`);
      }

      done();
    });
  }

  await app.register(helmet);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const allowed = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      callback(null, allowed);
    },
  });
  const startedAt = Date.now();
  const state: UiState = { pid: process.pid, port: 0, url: '', startedAt };
  await registerRoutes(app, options, state);
  const distRoot = path.resolve(process.cwd(), 'webapp', 'dist');
  const distExists = await fs
    .stat(distRoot)
    .then(() => true)
    .catch(() => false);

  if (distExists) {
    await app.register(fastifyStatic, { root: distRoot, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        reply.code(404).send({ error: 'Not Found' });

        return;
      }

      reply.sendFile('index.html');
    });
  }

  const { port, url } = await listenWithRetry(app, config.basePort ?? 17333);

  if (debugEnabled) {
    logger.info(`web ui server started on ${url} (port ${port})`);
  }

  state.port = config.uiPort ?? port;
  state.url = config.uiUrl ?? url;
  await writeUiState(state);

  const shutdown = async () => {
    await clearUiState();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { ...state, apiPort: port, apiUrl: url };
}

async function listenWithRetry(
  app: ReturnType<typeof fastify>,
  basePort: number,
): Promise<{ port: number; url: string }> {
  for (let offset = 0; offset < 50; offset += 1) {
    const port = basePort + offset;

    try {
      const url = await app.listen({ port, host: '127.0.0.1' });

      return { port, url };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err?.code === 'EADDRINUSE') {
        continue;
      }

      throw error;
    }
  }

  throw new Error('No available port');
}
