import { type CommandName, isCommandName } from './commands.ts';
import { consumesNext } from './flags.ts';

const STEP = 1;

interface ScanResult {
  readonly asksHelp: boolean;
  readonly first: string | undefined;
}

const isHelpFlag = (token: string): boolean => token === '--help' || token === '-h';

interface MutableScanState {
  asksHelp: boolean;
  first: string;
  index: number;
}

const processHelpToken = (
  token: string,
  next: string | undefined,
  state: MutableScanState,
): 'break' | 'continue' => {
  if (token === '--') {
    return 'break';
  }
  if (isHelpFlag(token)) {
    state.asksHelp = true;
  } else if (consumesNext(token, next)) {
    state.index += STEP;
  } else if (!token.startsWith('-') && state.first === '') {
    state.first = token;
  }
  return 'continue';
};

const scanHelpTokens = (argv: readonly string[]): ScanResult => {
  const state: MutableScanState = { asksHelp: false, first: '', index: 0 };
  for (; state.index < argv.length; state.index += STEP) {
    const token = argv[state.index];
    if (
      typeof token === 'string' &&
      processHelpToken(token, argv[state.index + STEP], state) === 'break'
    ) {
      break;
    }
  }
  // Empty string sentinel → undefined when no positional was found
  return { asksHelp: state.asksHelp, first: state.first || [].pop() };
};

const resolveTarget = (first: string | undefined): CommandName | undefined => {
  if (typeof first !== 'undefined' && isCommandName(first)) {
    return first;
  }
};

/**
 * Detect a --help / -h flag in argv before cac sees it (cac would otherwise
 * write to console.log itself). Returns the target command (when the first
 * positional names one) or 'root' for the top-level help.
 */
export const detectHelpFlag = (
  argv: readonly string[],
): { target: CommandName | undefined } | undefined => {
  const { asksHelp, first } = scanHelpTokens(argv);
  if (!asksHelp) {
    return [].pop();
  }
  return { target: resolveTarget(first) };
};

/**
 * Detect `--version` / `-v` ahead of cac for the same reason `detectHelpFlag`
 * exists. The `--` separator stops the scan so a trailing `--version` is left
 * for the (rejected) passthrough handler rather than flipping to the version
 * branch — siro forwards to no wrapped tool, so non-empty passthrough is a
 * usage error (see parseArgs).
 */
export const detectVersionFlag = (argv: readonly string[]): boolean => {
  for (let index = 0; index < argv.length; index += STEP) {
    const token = argv[index];
    if (typeof token === 'string') {
      if (token === '--') {
        return false;
      }
      // Cac registers `-v` as an alias of --version; honor both pre-cac.
      if (token === '--version' || token === '-v') {
        return true;
      }
      if (consumesNext(token, argv[index + STEP])) {
        index += STEP;
      }
    }
  }
  return false;
};
