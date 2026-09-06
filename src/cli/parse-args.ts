import { parseArgs } from 'node:util';
import path from 'node:path';
import { type AbsPath, asAbsPath } from '../shared/paths.ts';
import { UsageError } from '../shared/errors.ts';
import { type CommandName, isCommandName } from './commands.ts';
import type { PM, Severity } from '../domain/entities/pms.ts';
import type { ProjectType } from '../domain/entities/project-type.ts';
import { DEFAULT_REPORTER_NAME, JSON_REPORTER_NAME } from '../adapters/reporters/registry.ts';
import { parsePmFlag, parseProjectTypeFlag, parseSeverityFlag } from './parsers.ts';

export type ParsedCommand =
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

const VALUE_FLAGS = new Set(['pm', 'project-type', 'reporter', 'severity']);
const BOOLEAN_FLAGS = new Set(['help', 'version', 'json']);

export const parseCommand = (argv: readonly string[]): ParsedCommand => {
  // Tokenize first so a missing option value cannot consume a following --help.
  // Only siro's four value options consume the next positional token.
  const { tokens } = parseArgs({
    args: [...argv],
    options: { help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' } },
    strict: false,
    tokens: true,
  });
  const flags = new Map<string, string | true>();
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
        if (token.name === 'json' && flags.has('json'))
          error ??= '--json must be specified only once.';
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
        if (flags.has(token.name)) error ??= `${token.rawName} must be specified only once.`;
        flags.set(token.name, value);
      }
    } else {
      error ??= `Unknown flag: ${token.rawName}`;
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
  return {
    kind: 'lint',
    cwd: asAbsPath(path.resolve(cwd ?? process.cwd())),
    pm: parsePmFlag(flags.get('pm')),
    projectType: parseProjectTypeFlag(flags.get('project-type')),
    severity: parseSeverityFlag(flags.get('severity')),
    reporter:
      typeof reporter === 'string'
        ? reporter
        : flags.has('json')
          ? JSON_REPORTER_NAME
          : DEFAULT_REPORTER_NAME,
  };
};
