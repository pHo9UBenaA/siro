import { parseArgs } from 'node:util';
import path from 'node:path';
import { type AbsPath } from '../core/contracts/paths.ts';
import { asAbsPath } from '../adapters/node-paths.ts';
import { UsageError } from '../core/contracts/errors.ts';
import { type CommandName, isCommandName } from './commands.ts';
import type { PM, Severity } from '../core/contracts/pms.ts';
import type { ProjectType } from '../core/contracts/project-type.ts';
import { DEFAULT_REPORTER_NAME, JSON_REPORTER_NAME } from '../adapters/reporters/registry.ts';
import { parsePmFlag, parseProjectTypeFlag, parseSeverityFlag } from './parsers.ts';
import {
  DEFAULT_SCAN_LIMITS,
  resolveScanLimits,
  type ScanLimits,
} from '../core/contracts/scan-limits.ts';
import { isStableVersion } from '../core/pm-versions.ts';

export type ParsedCommand =
  | { kind: 'help'; target?: CommandName }
  | { kind: 'version' }
  | { kind: 'usage'; reason?: string }
  | {
      kind: 'lint';
      cwd: AbsPath;
      pm?: PM;
      pmVersion?: string;
      exclude?: readonly string[];
      installationRoots?: readonly string[];
      projectType?: ProjectType;
      reporter: string;
      severity?: Severity;
      noConfig?: boolean;
      rejectSymlinks?: boolean;
      limits?: Partial<ScanLimits>;
    };

const LIMIT_FLAGS = new Map(
  Object.keys(DEFAULT_SCAN_LIMITS).map((key) => [
    key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`),
    key as keyof ScanLimits,
  ]),
);
const REPEATABLE_FLAGS = new Set(['exclude', 'installation-root']);
const VALUE_FLAGS = new Set([
  'pm',
  'pm-version',
  'project-type',
  'reporter',
  'severity',
  ...REPEATABLE_FLAGS,
  ...LIMIT_FLAGS.keys(),
]);
const BOOLEAN_FLAGS = new Set(['help', 'version', 'json', 'no-config', 'strict-filesystem']);

export const parseCommand = (argv: readonly string[]): ParsedCommand => {
  // Tokenize first so a missing option value cannot consume a following --help.
  // Only siro's known value options consume the next positional token.
  const { tokens } = parseArgs({
    args: [...argv],
    options: { help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' } },
    strict: false,
    tokens: true,
  });
  const flags = new Map<string, string | true>();
  const repeated = new Map<string, string[]>();
  const positionals: string[] = [];
  let error: string | undefined;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) break;
    if (token.kind === 'option-terminator') {
      if (index + 1 < tokens.length) error ??= 'siro takes no passthrough arguments after `--`.';
      break;
    }
    if (token.kind === 'positional') {
      positionals.push(token.value);
      continue;
    }
    if (BOOLEAN_FLAGS.has(token.name)) {
      if (token.value !== undefined) {
        error ??= `Flag ${token.rawName} does not accept a value.`;
      } else {
        if (
          ['json', 'no-config', 'strict-filesystem'].includes(token.name) &&
          flags.has(token.name)
        )
          error ??= `${token.rawName} must be specified only once.`;
        flags.set(token.name, true);
      }
    } else if (VALUE_FLAGS.has(token.name)) {
      let value = token.value;
      const next = tokens[index + 1];
      if (value === undefined && next?.kind === 'positional' && next.index === token.index + 1) {
        value = next.value;
        index += 1;
      }
      if (value === undefined || value === '') {
        error ??= `${token.rawName} requires a value.`;
      } else {
        if (REPEATABLE_FLAGS.has(token.name)) {
          repeated.set(token.name, [...(repeated.get(token.name) ?? []), value]);
        } else {
          if (flags.has(token.name)) error ??= `${token.rawName} must be specified only once.`;
          flags.set(token.name, value);
        }
      }
    } else {
      error ??=
        token.name === 'workspaces'
          ? 'The --workspaces flag was removed in 0.6.0; discovery is recursive by default. Use --exclude and --installation-root.'
          : `Unknown flag: ${token.rawName}`;
    }
  }

  const [command, cwd, ...extra] = positionals;
  if (flags.has('help')) {
    return { kind: 'help', target: command && isCommandName(command) ? command : undefined };
  }
  if (flags.has('version')) return { kind: 'version' };
  if (error) throw new UsageError(error);
  if (command === undefined) return { kind: 'usage' };
  if (command === 'init') {
    return {
      kind: 'usage',
      reason:
        "The 'init' command was removed: siro is lint-only. Run `siro lint --reporter json` and review each finding's remediation.",
    };
  }
  if (!isCommandName(command)) return { kind: 'usage', reason: `Unknown command: ${command}` };
  if (extra.length > 0) throw new UsageError(`Unexpected extra argument: ${extra.join(' ')}`);
  if (flags.has('reporter') && flags.has('json')) {
    throw new UsageError('Invalid reporter selection: use either --reporter or --json.');
  }
  const reporter = flags.get('reporter');
  const pmVersion = flags.get('pm-version');
  const pm = parsePmFlag(flags.get('pm'));
  if (pmVersion !== undefined && (!pm || !isStableVersion(pmVersion)))
    throw new UsageError('--pm-version requires --pm and an exact stable version.');
  const limits: Partial<Record<keyof ScanLimits, number>> = {};
  for (const [flag, key] of LIMIT_FLAGS) {
    const value = flags.get(flag);
    if (value !== undefined) {
      if (typeof value !== 'string' || !/^\d+$/u.test(value))
        throw new UsageError(`${flag} must be a positive safe integer.`);
      limits[key] = Number(value);
    }
  }
  resolveScanLimits(limits);
  return {
    kind: 'lint',
    cwd: asAbsPath(path.resolve(cwd ?? process.cwd())),
    pm,
    pmVersion: typeof pmVersion === 'string' ? pmVersion : undefined,
    exclude: repeated.get('exclude'),
    installationRoots: repeated.get('installation-root'),
    projectType: parseProjectTypeFlag(flags.get('project-type')),
    severity: parseSeverityFlag(flags.get('severity')),
    ...(flags.has('no-config') ? { noConfig: true } : {}),
    ...(flags.has('strict-filesystem') ? { rejectSymlinks: true } : {}),
    ...(Object.keys(limits).length ? { limits } : {}),
    reporter:
      typeof reporter === 'string'
        ? reporter
        : flags.has('json')
          ? JSON_REPORTER_NAME
          : DEFAULT_REPORTER_NAME,
  };
};
