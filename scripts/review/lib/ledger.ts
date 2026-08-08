// Ledger entry formatting and ID allocation for DECISIONS.md / REJECTED.md.
// Extracted from ctx.ts.

const FIRST_CAPTURE = 1;
const HEADING_OFFSET = 1;
const FALLBACK_ZERO = 0;
const MIN_PAD_WIDTH = 2;
const BASE_TEN = 10;

export type LedgerKind = 'rejected' | 'decisions';

const LEDGER_PREFIX: Record<LedgerKind, 'R' | 'D'> = {
  decisions: 'D',
  rejected: 'R',
};

const LEDGER_ID_PATTERN: Record<LedgerKind, RegExp> = {
  decisions: /^## D(?<num>\d+) — /mu,
  rejected: /^## R(?<num>\d+) — /mu,
};

const MD_CONTROL = /[\n\r]/u;
const HEADING_IN_BODY = /^##? /mu;

export const nextLedgerId = (currentMd: string, kind: LedgerKind): string => {
  const pattern = new RegExp(LEDGER_ID_PATTERN[kind], 'gmu');
  let max = FALLBACK_ZERO;
  for (const md of currentMd.matchAll(pattern)) {
    const num = Number.parseInt(md[FIRST_CAPTURE] ?? '0', BASE_TEN);
    if (num > max) {
      max = num;
    }
  }
  const next = max + HEADING_OFFSET;
  const padded = next.toString().padStart(MIN_PAD_WIDTH, '0');
  return `${LEDGER_PREFIX[kind]}${padded}`;
};

export interface LedgerEntryInput {
  readonly kind: LedgerKind;
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

/**
 * Validate ledger entry ID and content. Throws on malformed input.
 */
const validateLedgerInput = (input: LedgerEntryInput): void => {
  const expected = new RegExp(`^${LEDGER_PREFIX[input.kind]}\\d+$`, 'u');
  if (!expected.test(input.id)) {
    throw new Error(
      `${input.kind} ledger requires id matching ${LEDGER_PREFIX[input.kind]}\\d+, got: ${JSON.stringify(input.id)}`,
    );
  }
  if (MD_CONTROL.test(input.title)) {
    throw new Error(`ledger title must not contain newlines: ${JSON.stringify(input.title)}`);
  }
  if (HEADING_IN_BODY.test(input.body)) {
    throw new Error('ledger body must not contain lines starting with "# " or "## "');
  }
};

export const formatLedgerEntry = (input: LedgerEntryInput): string => {
  validateLedgerInput(input);
  const heading = `## ${input.id} — ${input.title}`;
  let { body } = input;
  if (!body.endsWith('\n')) {
    body = `${body}\n`;
  }
  return `${heading}\n\n${body}`;
};

export const appendLedgerEntry = (currentMd: string, entry: string): string => {
  const trimmedEnd = currentMd.replace(/\n+$/u, '');
  if (trimmedEnd === '') {
    return entry;
  }
  return `${trimmedEnd}\n\n${entry}`;
};
