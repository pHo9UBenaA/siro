import { BUILTIN_REPORTER_NAMES } from '../adapters/reporters/registry.ts';
import { COMMANDS } from './commands.ts';
import type { FlagValues } from './flags.ts';
import { SEVERITIES } from '../domain/entities/pms.ts';
import { cac } from 'cac';
import { version } from '../version.ts';

const STEP = 1;
const ARGS_OFFSET = 2;

export interface CacOutput {
  readonly commandCandidate: unknown;
  readonly extraPositionals: readonly unknown[];
  readonly flags: FlagValues;
  readonly positionalCwd: unknown;
}

const buildCli = (): ReturnType<typeof cac> => {
  const cli = cac('siro');
  cli
    .option('--pm <name>', 'Target a specific package manager')
    .option('--project-type <type>', 'Project type (application|package)')
    .option('--reporter <name>', `Reporter (${BUILTIN_REPORTER_NAMES.join('|')})`)
    .option('--json', 'Shortcut for --reporter json')
    .option('--severity <level>', `Display/fail threshold (${SEVERITIES.join('|')})`)
    .help()
    .version(version);

  for (const name of COMMANDS) {
    let desc = `${name} a repository`;
    if (name === 'check') {
      desc = 'Alias of lint';
    }
    cli.command(`${name} [cwd]`, desc);
  }
  return cli;
};

const extractPositionalCwd = (
  matchedCommand: string | undefined,
  args: readonly unknown[],
): unknown => {
  if (matchedCommand) {
    const [cwd] = args;
    return cwd;
  }
  return args[STEP];
};

const extractCommandCandidate = (
  matchedCommand: string | undefined,
  args: readonly unknown[],
): unknown => {
  if (matchedCommand) {
    return matchedCommand;
  }
  const [candidate] = args;
  return candidate;
};

const extractExtraPositionals = (
  matchedCommand: string | undefined,
  args: readonly unknown[],
): readonly unknown[] => {
  if (matchedCommand) {
    return args.slice(STEP);
  }
  return args.slice(ARGS_OFFSET);
};

export const parseCacOutput = (argv: readonly string[]): CacOutput => {
  const cli = buildCli();
  const parsed = cli.parse(['node', 'siro', ...argv], { run: false });
  const flags: FlagValues = parsed.options;
  const matchedCommand = cli.matchedCommandName;
  const positionalCwd = extractPositionalCwd(matchedCommand, parsed.args);
  const commandCandidate = extractCommandCandidate(matchedCommand, parsed.args);
  const extraPositionals = extractExtraPositionals(matchedCommand, parsed.args);

  return { commandCandidate, extraPositionals, flags, positionalCwd };
};
