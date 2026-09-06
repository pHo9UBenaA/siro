#!/usr/bin/env node
import { assertDirectory } from './adapters/node-file-system.ts';
import { loadConfig } from './adapters/config-loader.ts';
import { SiroError } from './shared/errors.ts';
import { ensureNodeVersion } from './cli/parsers.ts';
import type { IO } from './domain/ports/io.ts';
import { isNodeError } from './adapters/node-errors.ts';
import { lintCommand } from './application/commands/lint.ts';
import { nodeIO } from './adapters/node-io.ts';
import { type ParsedCommand, parseCommand } from './cli/parse-args.ts';
import { pathToFileURL } from 'node:url';
import { renderHelp } from './cli/help.ts';
import { version } from './version.ts';

const EXIT_SUCCESS = 0;
const EXIT_USAGE = 2;
const EXIT_CRASH = 70;

const dispatch = (cmd: ParsedCommand, io: IO): number | Promise<number> => {
  switch (cmd.kind) {
    case 'version': {
      io.stdout(version);
      return EXIT_SUCCESS;
    }
    case 'help': {
      io.stdout(renderHelp(cmd.target));
      return EXIT_SUCCESS;
    }
    case 'usage': {
      if (cmd.reason) {
        io.stderr(`${cmd.reason}\n`);
      }
      io.stderr(renderHelp());
      return EXIT_USAGE;
    }
    case 'lint': {
      assertDirectory(cmd.cwd);
      return loadConfig(cmd.cwd).then((config) => lintCommand({ ...cmd, config }, io));
    }
    default: {
      const exhaustiveCheck: never = cmd;
      throw new Error(`Unhandled command kind: ${String(exhaustiveCheck)}`);
    }
  }
};

const handleError = (error: unknown, io: IO): number => {
  if (error instanceof SiroError) {
    io.stderr(error.message);
    return error.exitCode;
  }
  // Numeric errno distinguishes filesystem failures from Node's ERR_* exceptions.
  if (isNodeError(error) && 'errno' in error && typeof error.errno === 'number') {
    io.stderr(`File system error: ${error.message}`);
    return EXIT_USAGE;
  }
  throw error;
};

export const run = async (argv: readonly string[], io: IO = nodeIO): Promise<number> => {
  try {
    ensureNodeVersion(process.versions.node);
    const cmd = parseCommand(argv);
    return await dispatch(cmd, io);
  } catch (error) {
    return handleError(error, io);
  }
};

export const runMain = async (argv: readonly string[]): Promise<void> => {
  try {
    process.exitCode = await run(argv);
  } catch (error) {
    // Keep unexpected failures distinct from the exit-1 "findings found" result.
    const errStr = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${errStr}\n`);
    process.exitCode = EXIT_CRASH;
  }
};

const [, invokedPath] = process.argv;
const isDirectInvocation = invokedPath && import.meta.url === pathToFileURL(invokedPath).href;
if (isDirectInvocation) {
  await runMain(process.argv.slice(2));
}
