import { PMS, SEVERITIES } from '../domain/entities/pms.ts';
import { BUILTIN_REPORTER_NAMES } from '../adapters/reporters/registry.ts';
import type { CommandName } from './commands.ts';

const PMS_LIST = PMS.join('|');
const REPORTERS_LIST = BUILTIN_REPORTER_NAMES.join('|');
const SEVERITIES_LIST = SEVERITIES.join('|');

// SSOT for every flag description that appears in more than one help page.
// Keeping the rendered line in one place stops the three `--pm` instances
// (root + lint) and the two `--reporter` instances (root + lint) from
// drifting in wording or whitespace under future edits.
const FLAG_LINES = {
  json: '  --json               Shortcut for --reporter json',
  pm: `  --pm <name>          Target a specific package manager (${PMS_LIST})`,
  reporter: `  --reporter <name>    Reporter (${REPORTERS_LIST}; additional reporters can be registered via siro.config.ts)`,
  severity: `  --severity <level>   Show + fail on findings at or above this level (${SEVERITIES_LIST})`,
} as const;

const HELP_ROOT = [
  'siro — security best-practices for the npm ecosystem',
  '',
  'USAGE',
  '  siro <command> [path] [flags]',
  '',
  'COMMANDS',
  '  lint     Report best-practice violations (alias: check)',
  '',
  'GLOBAL FLAGS',
  FLAG_LINES.pm,
  '  --version            Print the siro version',
  '  --help               Show help for siro or a command',
  '',
  'LINT FLAGS',
  FLAG_LINES.reporter,
  FLAG_LINES.json,
  FLAG_LINES.severity,
  '',
  'EXAMPLES',
  '  $ siro lint                         # report violations in cwd',
  '  $ siro lint --reporter github       # GitHub Actions annotations',
  '  $ siro lint --severity warn         # also fail on warnings',
  '',
  'LEARN MORE',
  '  Quickstart        https://github.com/pHo9UBenaA/siro/blob/main/docs/getting-started.md',
  '  Rule reference    https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md',
  '  Config options    https://github.com/pHo9UBenaA/siro/blob/main/docs/configuration.md',
].join('\n');

const HELP_LINT = [
  'siro lint — report best-practice violations',
  '',
  'USAGE',
  '  siro lint [path] [flags]',
  '  siro check [path] [flags]        (alias)',
  '',
  'FLAGS',
  FLAG_LINES.pm,
  FLAG_LINES.reporter,
  FLAG_LINES.json,
  FLAG_LINES.severity,
  '',
  'EXIT CODES',
  '  0  No findings at or above the active threshold',
  '  1  Findings at or above the threshold (default: error)',
  '  2  Usage error (bad flag, broken siro.config.ts, unreadable path, …)',
  '  70 Uncaught exception (a siro bug, or a reporter / custom rule that threw)',
  '',
  'EXAMPLES',
  '  $ siro lint                         # default: pretty reporter, fail on errors',
  '  $ siro lint --reporter github       # GitHub Actions annotations',
  '  $ siro lint --severity warn         # tighten the gate',
].join('\n');

export const renderHelp = (target?: CommandName): string => {
  if (typeof target === 'undefined') {
    return HELP_ROOT;
  }
  if (target === 'lint' || target === 'check') {
    return HELP_LINT;
  }
  const exhaustiveCheck: never = target;
  return exhaustiveCheck;
};
