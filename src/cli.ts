#!/usr/bin/env node
import { type AbsPath, asAbsPath } from './shared/paths.ts';
import { type CommandName, isCommandName } from './cli/commands.ts';
import { KNOWN_FLAGS, flagsFor } from './cli/flags.ts';
import type { PM, Severity } from './domain/entities/pms.ts';
import { SiroError, UsageError } from './shared/errors.ts';
import { detectHelpFlag, detectVersionFlag } from './cli/scanners.ts';
import {
  ensureNodeVersion,
  parsePmFlag,
  parseSeverityFlag,
  rejectUnknownFlags,
  resolveReporter,
} from './cli/parsers.ts';
import type { IO } from './domain/ports/io.ts';
import { isNodeError } from './adapters/node-errors.ts';
import { lintCommand } from './application/commands/lint.ts';
import { nodeIO } from './adapters/node-io.ts';
import { parseCacOutput } from './cli/cac-bridge.ts';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderHelp } from './cli/help.ts';
import { version } from './version.ts';

type ParsedCommand =
  | { kind: 'help'; target?: CommandName }
  | { kind: 'version' }
  | { kind: 'usage'; reason?: string }
  | { kind: 'lint'; cwd: AbsPath; pm?: PM; reporter: string; severity?: Severity };

const EMPTY = 0;
const EXIT_SUCCESS = 0;
const EXIT_USAGE = 2;
const EXIT_CRASH = 70;

const rejectPassthrough = (flags: Record<string, unknown>): void => {
  // siro wraps no downstream tool, so anything after `--` has nowhere to go.
  const passthrough = flags['--'];
  if (Array.isArray(passthrough) && passthrough.length > EMPTY) {
    throw new UsageError('siro takes no passthrough arguments after `--`.');
  }
};

const resolveCommandCandidate = (
  commandCandidate: unknown,
): { kind: 'usage'; reason?: string } | { kind: 'command'; name: CommandName } => {
  if (typeof commandCandidate === 'undefined') {
    return { kind: 'usage' };
  }
  if (commandCandidate === 'init') {
    return {
      kind: 'usage',
      reason:
        "The 'init' command was removed: siro is lint-only. Run `siro lint --reporter json` and apply each finding's `fix` operations with your editor or an agent skill.",
    };
  }
  if (typeof commandCandidate !== 'string' || !isCommandName(commandCandidate)) {
    return { kind: 'usage', reason: `Unknown command: ${String(commandCandidate)}` };
  }
  return { kind: 'command', name: commandCandidate };
};

const SINGLE = 1;

const rejectExtraPositionals = (extraPositionals: readonly unknown[]): void => {
  if (extraPositionals.length > EMPTY) {
    let plural = '';
    if (extraPositionals.length > SINGLE) {
      plural = 's';
    }
    throw new UsageError(`Unexpected extra argument${plural}: ${extraPositionals.join(' ')}`);
  }
};

const resolveCwd = (positionalCwd: unknown): AbsPath => {
  let raw: string = process.cwd();
  if (typeof positionalCwd === 'string') {
    raw = positionalCwd;
  }
  return asAbsPath(path.resolve(raw));
};

const checkPreScanFlags = (argv: readonly string[]): ParsedCommand | undefined => {
  // cac calls console.log/exit on --help/--version itself; intercept those
  // BEFORE handing argv to it so output stays inside the injected IO.
  const preHelp = detectHelpFlag(argv);
  if (typeof preHelp !== 'undefined') {
    return { kind: 'help', target: preHelp.target };
  }
  if (detectVersionFlag(argv)) {
    return { kind: 'version' };
  }
  return void 0;
};

const buildLintCommand = (
  flags: Record<string, unknown>,
  positionalCwd: unknown,
  commandCandidate: CommandName,
): ParsedCommand => {
  rejectUnknownFlags(flags, flagsFor(commandCandidate), commandCandidate);
  return {
    cwd: resolveCwd(positionalCwd),
    kind: 'lint',
    pm: parsePmFlag(flags.pm),
    reporter: resolveReporter(flags),
    severity: parseSeverityFlag(flags.severity),
  };
};

const validateFlags = (flags: Record<string, unknown>): void => {
  rejectUnknownFlags(flags, KNOWN_FLAGS);
  rejectPassthrough(flags);
};

const parseArgs = (argv: readonly string[]): ParsedCommand => {
  const preScan = checkPreScanFlags(argv);
  if (typeof preScan !== 'undefined') {
    return preScan;
  }

  const { commandCandidate, extraPositionals, flags, positionalCwd } = parseCacOutput(argv);

  validateFlags(flags);

  const resolved = resolveCommandCandidate(commandCandidate);
  if (resolved.kind === 'usage') {
    return resolved;
  }
  // Only one positional (the optional cwd) is meaningful after the command.
  // Silently dropping extras would let `siro lint pnpm` (a typo'd `--pm pnpm`)
  // run against a 'pnpm' directory — reject like the `--` passthrough above.
  rejectExtraPositionals(extraPositionals);

  return buildLintCommand(flags, positionalCwd, resolved.name);
};

const handleVersion = (io: IO): Promise<number> => {
  io.stdout(version);
  return Promise.resolve(EXIT_SUCCESS);
};

const handleHelp = (target: CommandName | undefined, io: IO): Promise<number> => {
  io.stdout(renderHelp(target));
  return Promise.resolve(EXIT_SUCCESS);
};

const handleUsage = (reason: string | undefined, io: IO): Promise<number> => {
  if (typeof reason !== 'undefined') {
    io.stderr(`${reason}\n`);
  }
  io.stderr(renderHelp());
  return Promise.resolve(EXIT_USAGE);
};

const dispatch = (cmd: ParsedCommand, io: IO): Promise<number> => {
  switch (cmd.kind) {
    case 'version': {
      return handleVersion(io);
    }
    case 'help': {
      return handleHelp(cmd.target, io);
    }
    case 'usage': {
      return handleUsage(cmd.reason, io);
    }
    case 'lint': {
      return lintCommand(cmd, io);
    }
    default: {
      const exhaustiveCheck: never = cmd;
      throw new Error(`Unhandled command kind: ${String(exhaustiveCheck)}`);
    }
  }
};

const handleAsyncError = (error: unknown, io: IO): number => {
  if (error instanceof SiroError) {
    io.stderr(error.message);
    return error.exitCode;
  }
  // Filesystem errno errors (EACCES, ENOTDIR, EROFS, …) are environment
  // problems the user can act on, not siro bugs — route them to the
  // usage-error exit code instead of the crash path (70). The numeric
  // `errno` requirement keeps Node-internal `ERR_*` errors (which also
  // carry a string `code`) on the crash path where they belong.
  if (isNodeError(error) && typeof error.errno === 'number') {
    io.stderr(`File system error: ${error.message}`);
    return EXIT_USAGE;
  }
  throw error;
};

const handleSyncError = (error: unknown, io: IO): Promise<number> => {
  if (error instanceof SiroError) {
    io.stderr(error.message);
    return Promise.resolve(error.exitCode);
  }
  if (isNodeError(error) && typeof error.errno === 'number') {
    io.stderr(`File system error: ${error.message}`);
    return Promise.resolve(EXIT_USAGE);
  }
  return Promise.reject(error);
};

export const run = (argv: readonly string[], io: IO = nodeIO): Promise<number> => {
  try {
    ensureNodeVersion(process.versions.node);
    const cmd = parseArgs(argv);
    return dispatch(cmd, io).catch((error: unknown) => handleAsyncError(error, io));
  } catch (error) {
    return handleSyncError(error, io);
  }
};

const onRunFulfilled = (code: number): void => {
  process.exitCode = code;
};

const onRunRejected = (error: unknown): void => {
  // `run` re-throws non-SiroError; without this catch it becomes an
  // unhandledRejection (Node exit 1), indistinguishable from "findings
  // found". Use a dedicated code so CI can tell a crash from a result.
  let errStr = String(error);
  if (error instanceof Error) {
    errStr = error.stack ?? error.message;
  }
  process.stderr.write(`${errStr}\n`);
  process.exitCode = EXIT_CRASH;
};

const ARGV_SKIP = 2;
const [, invokedPath] = process.argv;
const isDirectInvocation = invokedPath && import.meta.url === pathToFileURL(invokedPath).href;
if (isDirectInvocation) {
  try {
    const code = await run(process.argv.slice(ARGV_SKIP));
    onRunFulfilled(code);
  } catch (error: unknown) {
    onRunRejected(error);
  }
}
