#!/usr/bin/env node
import { assertDirectory } from './adapters/node-file-system.ts';
import { loadConfig } from './load-config.ts';
import { SiroError } from './core/contracts/errors.ts';
import { ensureNodeVersion } from './cli/parsers.ts';
import type { IO } from './core/contracts/io.ts';
import { isNodeError } from './adapters/node-errors.ts';
import { lintCommand } from './runtime.ts';
import { nodeIO } from './adapters/node-io.ts';
import { type ParsedCommand, parseCommand } from './cli/parse-args.ts';
import { pathToFileURL } from 'node:url';
import { renderHelp } from './cli/help.ts';
import { version } from './version.ts';
import { safeText } from './adapters/safe-text.ts';

const EXIT_SUCCESS = 0;
const EXIT_USAGE = 2;
const EXIT_CRASH = 70;

const dispatch = async (command: ParsedCommand, io: IO): Promise<number> => {
  switch (command.kind) {
    case 'version': {
      await io.stdout(version);
      return EXIT_SUCCESS;
    }
    case 'help': {
      await io.stdout(renderHelp(command.target));
      return EXIT_SUCCESS;
    }
    case 'usage': {
      if (command.reason) {
        await io.stderr(`${safeText(command.reason)}\n`);
      }
      await io.stderr(renderHelp());
      return EXIT_USAGE;
    }
    case 'lint': {
      assertDirectory(command.cwd);
      const { noConfig, ...options } = command;
      if (noConfig) return lintCommand(options, io);
      const config = await loadConfig(command.cwd);
      return lintCommand({ ...options, config }, io);
    }
    default: {
      const exhaustiveCheck: never = command;
      throw new Error(`Unhandled command kind: ${String(exhaustiveCheck)}`);
    }
  }
};

const handleError = async (error: unknown, io: IO): Promise<number> => {
  if (error instanceof SiroError) {
    await io.stderr(safeText(error.message));
    return error.exitCode;
  }
  // Numeric errno distinguishes filesystem failures from Node's ERR_* exceptions.
  if (isNodeError(error) && 'errno' in error && typeof error.errno === 'number') {
    await io.stderr(safeText(`File system error: ${error.message}`));
    return EXIT_USAGE;
  }
  throw error;
};

export const run = async (argv: readonly string[], io: IO = nodeIO): Promise<number> => {
  try {
    ensureNodeVersion(process.versions.node);
    const command = parseCommand(argv);
    return await dispatch(command, io);
  } catch (error) {
    return handleError(error, io);
  }
};

export const runMain = async (argv: readonly string[]): Promise<void> => {
  try {
    process.exitCode = await run(argv);
  } catch (error) {
    // Keep unexpected failures distinct from the exit-1 "findings found" result.
    const diagnostic = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.exitCode = EXIT_CRASH;
    try {
      await nodeIO.stderr(safeText(diagnostic));
    } catch {
      // A broken diagnostic sink cannot report its own failure. Keep exit 70;
      // do not recurse or leave another stream error/rejection unobserved.
    }
  }
};

const [, invokedPath] = process.argv;
const isDirectInvocation = invokedPath && import.meta.url === pathToFileURL(invokedPath).href;
if (isDirectInvocation) {
  await runMain(process.argv.slice(2));
}
