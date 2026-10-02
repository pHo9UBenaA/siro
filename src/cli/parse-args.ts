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
import { resolveScanLimits, type ScanLimits } from '../core/contracts/scan-limits.ts';
import { isStableVersion } from '../core/pm-versions.ts';
import { LIMIT_OPTIONS } from './limit-options.ts';

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

const REPEATABLE_FLAGS = new Set(['exclude', 'installation-root']);
const VALUE_FLAGS = new Set([
  'pm',
  'pm-version',
  'project-type',
  'reporter',
  'severity',
  ...REPEATABLE_FLAGS,
  ...LIMIT_OPTIONS.map(({ flag }) => flag),
]);
const BOOLEAN_FLAGS = new Set(['help', 'version', 'json', 'no-config', 'strict-filesystem']);

const collectArguments = (argv: readonly string[]) => {
  // Only known value options consume the next positional token, never a following --help.
  const { tokens } = parseArgs({
    args: [...argv],
    options: { help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' } },
    strict: false,
    tokens: true,
  });
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const repeatedFlags = new Map<string, string[]>();
  const positionals: string[] = [];
  let firstError: string | undefined;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) break;
    if (token.kind === 'option-terminator') {
      if (index + 1 < tokens.length)
        firstError ??= 'siro takes no passthrough arguments after `--`.';
      break;
    }
    if (token.kind === 'positional') {
      positionals.push(token.value);
      continue;
    }
    if (BOOLEAN_FLAGS.has(token.name)) {
      if (token.value !== undefined) {
        firstError ??= `Flag ${token.rawName} does not accept a value.`;
        continue;
      }
      if (['json', 'no-config', 'strict-filesystem'].includes(token.name) && flags.has(token.name))
        firstError ??= `${token.rawName} must be specified only once.`;
      flags.add(token.name);
      continue;
    }
    if (!VALUE_FLAGS.has(token.name)) {
      firstError ??=
        token.name === 'workspaces'
          ? 'The --workspaces flag was removed in 0.6.0; discovery is recursive by default. Use --exclude and --installation-root.'
          : `Unknown flag: ${token.rawName}`;
      continue;
    }
    let value = token.value;
    const next = tokens[index + 1];
    if (value === undefined && next?.kind === 'positional' && next.index === token.index + 1) {
      value = next.value;
      index += 1;
    }
    if (value === undefined || value === '') {
      firstError ??= `${token.rawName} requires a value.`;
      continue;
    }
    if (REPEATABLE_FLAGS.has(token.name)) {
      repeatedFlags.set(token.name, [...(repeatedFlags.get(token.name) ?? []), value]);
    } else {
      if (values.has(token.name)) firstError ??= `${token.rawName} must be specified only once.`;
      values.set(token.name, value);
    }
  }
  return { flags, values, repeatedFlags, positionals, firstError };
};

const parseLimitOverrides = (values: ReadonlyMap<string, string>): Partial<ScanLimits> => {
  const limits: Partial<Record<keyof ScanLimits, number>> = {};
  for (const { flag, key } of LIMIT_OPTIONS) {
    const value = values.get(flag);
    if (value === undefined) continue;
    if (!/^\d+$/u.test(value)) throw new UsageError(`${flag} must be a positive safe integer.`);
    limits[key] = Number(value);
  }
  resolveScanLimits(limits);
  return limits;
};

export const parseCommand = (argv: readonly string[]): ParsedCommand => {
  const { flags, values, repeatedFlags, positionals, firstError } = collectArguments(argv);
  const [command, cwd, ...extra] = positionals;
  if (flags.has('help')) {
    return { kind: 'help', target: command && isCommandName(command) ? command : undefined };
  }
  if (flags.has('version')) return { kind: 'version' };
  if (firstError) throw new UsageError(firstError);
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
  if (values.has('reporter') && flags.has('json')) {
    throw new UsageError('Invalid reporter selection: use either --reporter or --json.');
  }
  const reporter =
    values.get('reporter') ?? (flags.has('json') ? JSON_REPORTER_NAME : DEFAULT_REPORTER_NAME);
  const pmVersion = values.get('pm-version');
  const pm = parsePmFlag(values.get('pm'));
  if (pmVersion !== undefined && (!pm || !isStableVersion(pmVersion)))
    throw new UsageError('--pm-version requires --pm and an exact stable version.');
  const limits = parseLimitOverrides(values);
  return {
    kind: 'lint',
    cwd: asAbsPath(path.resolve(cwd ?? process.cwd())),
    pm,
    pmVersion,
    exclude: repeatedFlags.get('exclude'),
    installationRoots: repeatedFlags.get('installation-root'),
    projectType: parseProjectTypeFlag(values.get('project-type')),
    severity: parseSeverityFlag(values.get('severity')),
    ...(flags.has('no-config') ? { noConfig: true } : {}),
    ...(flags.has('strict-filesystem') ? { rejectSymlinks: true } : {}),
    ...(Object.keys(limits).length ? { limits } : {}),
    reporter,
  };
};
