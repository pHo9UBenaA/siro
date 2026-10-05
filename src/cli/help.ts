import { PMS, SEVERITIES } from '../core/contracts/pms.ts';
import { BUILTIN_REPORTER_NAMES } from '../adapters/reporters/registry.ts';
import type { CommandName } from './commands.ts';
import { PROJECT_TYPES } from '../core/contracts/project-type.ts';
import { limitHelp } from './limit-options.ts';

const PMS_LIST = PMS.join('|');
const REPORTERS_LIST = BUILTIN_REPORTER_NAMES.join('|');
const PROJECT_TYPES_LIST = PROJECT_TYPES.join('|');
const SEVERITIES_LIST = SEVERITIES.join('|');

const FLAG_LINES = {
  json: '  --json               Shortcut for --reporter json',
  safety:
    '  --config <path>      Select JSON settings or explicitly trust JS/TS config\n  --no-config          Do not probe or load repository configuration\n  --strict-filesystem  Reject symlink input paths (not a containment sandbox)',
  limits: limitHelp,
  pm: `  --pm <name>          Target a specific package manager (${PMS_LIST})`,
  pmVersion: '  --pm-version <x.y.z>  Target an exact stable PM version (requires --pm)',
  inspection:
    '  --exclude <pattern>  Exclude directories from recursive discovery (repeatable)\n  --installation-root <path>  Inspect local install policy here (repeatable; default .)',
  projectType: `  --project-type <type>  Project type (${PROJECT_TYPES_LIST}; default auto)`,
  reporter: `  --reporter <name>    Reporter (${REPORTERS_LIST}; custom reporters require --config)`,
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
  FLAG_LINES.pmVersion,
  FLAG_LINES.inspection,
  FLAG_LINES.projectType,
  '  --version            Print the siro version',
  '  --help               Show help for siro or a command',
  '',
  'LINT FLAGS',
  FLAG_LINES.safety,
  FLAG_LINES.limits,
  FLAG_LINES.reporter,
  FLAG_LINES.json,
  FLAG_LINES.severity,
  '',
  'EXAMPLES',
  '  $ siro lint                         # report violations in cwd',
  '  $ siro lint --no-config --strict-filesystem  # data-only inspection',
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
  FLAG_LINES.safety,
  FLAG_LINES.limits,
  FLAG_LINES.pm,
  FLAG_LINES.pmVersion,
  FLAG_LINES.inspection,
  FLAG_LINES.projectType,
  FLAG_LINES.reporter,
  FLAG_LINES.json,
  FLAG_LINES.severity,
  '',
  'EXIT CODES',
  '  0  No findings at or above the active threshold',
  '  1  Findings at or above the threshold (default: error)',
  '  2  Usage error (bad flag, invalid config, unreadable path, …)',
  '  70 Output failure/limit, or unexpected exception (including trusted extensions)',
  '',
  'EXAMPLES',
  '  $ siro lint                         # default: pretty reporter, fail on errors',
  '  $ siro lint --no-config --strict-filesystem  # data-only inspection',
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
