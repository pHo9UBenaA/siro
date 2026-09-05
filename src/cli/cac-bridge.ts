import { BUILTIN_REPORTER_NAMES } from '../adapters/reporters/registry.ts';
import { COMMANDS } from './commands.ts';
import { SEVERITIES } from '../domain/entities/pms.ts';
import { cac } from 'cac';

export interface CacOutput {
  readonly commandCandidate: unknown;
  readonly flags: Record<string, unknown>;
  readonly knownFlags: ReadonlySet<string>;
  readonly positionals: readonly unknown[];
}

const buildCli = (): ReturnType<typeof cac> => {
  const cli = cac('siro');
  cli
    .option('--pm <name>', 'Target a specific package manager')
    .option('--project-type <type>', 'Project type (application|package)')
    .option('--reporter <name>', `Reporter (${BUILTIN_REPORTER_NAMES.join('|')})`)
    .option('--json', 'Shortcut for --reporter json')
    .option('--severity <level>', `Display/fail threshold (${SEVERITIES.join('|')})`)
    .option('-h, --help', 'Display help')
    .option('-v, --version', 'Display version');

  for (const name of COMMANDS) {
    let desc = `${name} a repository`;
    if (name === 'check') {
      desc = 'Alias of lint';
    }
    cli.command(`${name} [cwd]`, desc);
  }
  return cli;
};

export const parseCacOutput = (argv: readonly string[]): CacOutput => {
  const cli = buildCli();
  const parsed = cli.parse(['node', 'siro', ...argv], { run: false });
  const flags: Record<string, unknown> = parsed.options;
  const knownFlags = new Set([
    '--',
    ...cli.globalCommand.options.flatMap((option) => option.names),
  ]);
  const commandCandidate = cli.matchedCommandName ?? parsed.args[0];
  const positionals = cli.matchedCommandName ? parsed.args : parsed.args.slice(1);

  return { commandCandidate, flags, knownFlags, positionals };
};
