import { COMMANDS, type CommandName } from './commands.ts';

const ARGS_OFFSET = 2;

// Single source of flag metadata. `takesValue` derives VALUE_FLAGS (the
// Pre-cac scanners use it to skip a flag's value token), and the keys are the
// `keyof typeof FLAGS` constraint the per-command scopes below `satisfies`, so
// A typo'd scope entry is a compile error. `check` shares `lint`'s scope by
// Reference (LINT_FLAGS), so a lint flag can't go missing from the alias.
// CAC_KEYS are aliases/metadata cac injects ('v', 'h', '--'). Not derived from
// Here: the cac `.option()` calls and help.ts FLAG_LINES carry the human
// Descriptions and stay hand-written (see those sites).
const FLAGS = {
  json: { takesValue: false },
  pm: { takesValue: true },
  reporter: { takesValue: true },
  severity: { takesValue: true },
} as const satisfies Record<string, { takesValue: boolean }>;

/** Flags that consume the following argv token; pre-cac scanners skip that token. */
const VALUE_FLAGS: ReadonlySet<string> = new Set(
  Object.entries(FLAGS)
    .filter(([, meta]) => meta.takesValue)
    .map(([name]) => name),
);

const LINT_FLAGS = [
  'pm',
  'reporter',
  'json',
  'severity',
] as const satisfies readonly (keyof typeof FLAGS)[];

const FLAG_SCOPES = {
  check: LINT_FLAGS,
  lint: LINT_FLAGS,
} as const satisfies Record<CommandName, readonly (keyof typeof FLAGS)[]>;

const GLOBAL_FLAGS = ['version', 'help'] as const;
const CAC_KEYS = ['v', 'h', '--'] as const;

export const flagsFor = (command: CommandName): ReadonlySet<string> =>
  new Set<string>([...FLAG_SCOPES[command], ...GLOBAL_FLAGS, ...CAC_KEYS]);

// Derived from `flagsFor` so the union stays in lockstep with the per-command
// Scopes — a new flag added to one command can never go missing from the
// Pre-dispatch validation step.
const collectAllFlags = (): ReadonlySet<string> => {
  const all: string[] = [];
  for (const command of COMMANDS) {
    for (const flag of flagsFor(command)) {
      all.push(flag);
    }
  }
  return new Set(all);
};

export const KNOWN_FLAGS: ReadonlySet<string> = collectAllFlags();

/**
 * Whether a `--name value` flag consumes the following argv token. Only the
 * separate-token form of a value-taking flag does (`--name=value` carries its
 * own value), AND only when the next token isn't itself a `-`-prefixed flag —
 * so `--reporter --help` leaves `--help` for the help/version detectors rather
 * than eating it as the reporter value. Shared by both pre-cac scanners so the
 * skip predicate stays in one place.
 */
export const consumesNext = (token: string, next: string | undefined): boolean =>
  token.startsWith('--') &&
  !token.includes('=') &&
  VALUE_FLAGS.has(token.slice(ARGS_OFFSET)) &&
  typeof next !== 'undefined' &&
  !next.startsWith('-');
