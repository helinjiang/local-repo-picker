#!/usr/bin/env node

import { handleFatalError } from './cli/errors';
import { runCli } from './cli/main';

process.on('unhandledRejection', (reason) => {
  handleFatalError(reason);
});

process.on('uncaughtException', (error) => {
  handleFatalError(error);
});

await runCli();
