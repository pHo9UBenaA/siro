#!/usr/bin/env node
import { type AbsPath, asAbsPath } from './shared/paths.ts';
import { type CommandName, isCommandName } from './cli/commands.ts';
import type { PM, Severity } from './domain/entities/pms.ts';
import { SiroError, UsageError } from './shared/errors.ts';
import {
  ensureNodeVersion,
  parsePmFlag,
  parseProjectTypeFlag,
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
import type { ProjectType } from './domain/entities/project-type.ts';

type ParsedCommand =
  | { kind: 'help'; target?: CommandName }
  | { kind: 'version' }
  | { kind: 'usage'; reason?: string }
  | {
      kind: 'lint';
      cwd: AbsPath;
      pm?: PM;
      projectType?: ProjectType;
      reporter: string;
      severity?: Severity;
    };

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

const resolveCommandUsage = (
  commandCandidate: unknown,
): { kind: 'usage'; reason?: string } | undefined => {
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

const isEnabledFlag = (value: unknown): boolean =>
  value === true || (Array.isArray(value) && value.some((item) => item === true));

const parseArgs = (argv: readonly string[]): ParsedCommand => {
  const { commandCandidate, flags, knownFlags, positionals } = parseCacOutput(argv);
  if (isEnabledFlag(flags.help)) {
    return {
      kind: 'help',
      target:
        typeof commandCandidate === 'string' && isCommandName(commandCandidate)
          ? commandCandidate
          : undefined,
    };
  }
  if (isEnabledFlag(flags.version)) {
    return { kind: 'version' };
  }

  rejectUnknownFlags(flags, knownFlags);
  rejectPassthrough(flags);

  const usage = resolveCommandUsage(commandCandidate);
  if (usage) {
    return usage;
  }
  // Only one positional (the optional cwd) is meaningful after the command.
  // Silently dropping extras would let `siro lint pnpm` (a typo'd `--pm pnpm`)
  // run against a 'pnpm' directory — reject like the `--` passthrough above.
  const [positionalCwd, ...extraPositionals] = positionals;
  rejectExtraPositionals(extraPositionals);

  return {
    cwd: resolveCwd(positionalCwd),
    kind: 'lint',
    pm: parsePmFlag(flags.pm),
    projectType: parseProjectTypeFlag(flags.projectType),
    reporter: resolveReporter(flags),
    severity: parseSeverityFlag(flags.severity),
  };
};

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
      return lintCommand(cmd, io);
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

export const run = async (argv: readonly string[], io: IO = nodeIO): Promise<number> => {
  try {
    ensureNodeVersion(process.versions.node);
    const cmd = parseArgs(argv);
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

const ARGV_SKIP = 2;
const [, invokedPath] = process.argv;
const isDirectInvocation = invokedPath && import.meta.url === pathToFileURL(invokedPath).href;
if (isDirectInvocation) {
  await runMain(process.argv.slice(ARGV_SKIP));
}
