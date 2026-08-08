/**
 * Pure parsers for the `/review` ledger files and the on-disk state.
 * Heading-anchored markdown parsing and first-sentence extraction live
 * here; observation, ledger, and state helpers are in sibling modules
 * and re-exported below so callers keep a single import path.
 */

export interface RejectedEntry {
  readonly id: string;
  readonly slug: string;
  readonly oneline: string;
}

export interface DecisionEntry {
  readonly id: string;
  readonly title: string;
  readonly oneline: string;
}

export interface AxisEntry {
  readonly id: string;
  readonly axis: string;
  readonly oneline: string;
}

const HEADING_OFFSET = 1;
const EMPTY_LENGTH = 0;
const LAST_ELEMENT = -1;
const FALLBACK_ZERO = 0;
const FIRST_ELEMENT = 0;
const INDEX_STEP = 1;

const REJECTED_HEADING = /^## (?<id>R\d+) — (?<slug>.+)$/u;
const DECISION_HEADING = /^## (?<id>D\d+) — (?<title>.+)$/u;
const AXIS_HEADING = /^### (?<num>\d+)\. `(?<axis>[^`]+)`/u;

const ONELINE_PREFIX = /^\*\*[^*]+\*\*\s*/u;

/**
 * Collect body lines between the heading match and the next boundary,
 * trimming leading and trailing blank lines.
 */
const collectBody = (
  lines: string[],
  idx: number,
  isBoundary: (line: string) => boolean,
): { body: string; endIdx: number } => {
  let endIdx = idx + HEADING_OFFSET;
  while (endIdx < lines.length && !isBoundary(lines[endIdx] ?? '')) {
    endIdx += INDEX_STEP;
  }
  const bodyLines = lines.slice(idx + HEADING_OFFSET, endIdx);
  while (bodyLines.length > EMPTY_LENGTH && bodyLines[FIRST_ELEMENT] === '') {
    bodyLines.shift();
  }
  while (bodyLines.length > EMPTY_LENGTH && bodyLines.at(LAST_ELEMENT) === '') {
    bodyLines.pop();
  }
  return { body: bodyLines.join('\n'), endIdx };
};

/**
 * Split markdown into heading-anchored entries.
 */
const splitByHeading = (
  markdown: string,
  pattern: RegExp,
  isBoundary: (line: string) => boolean,
): { match: RegExpMatchArray; body: string }[] => {
  const lines = markdown.split('\n');
  const entries: { match: RegExpMatchArray; body: string }[] = [];
  for (let idx = 0; idx < lines.length; idx += INDEX_STEP) {
    const headingMatch = (lines[idx] ?? '').match(pattern);
    if (headingMatch) {
      const { body, endIdx } = collectBody(lines, idx, isBoundary);
      entries.push({ body, match: headingMatch });
      idx = endIdx - HEADING_OFFSET;
    }
  }
  return entries;
};

const ABBREVIATION_END = /(?:\be\.g|\bi\.e|\bcf|\bvs|\betc|\bal)\.$/iu;
const FIRST_PARAGRAPH_SPLIT_LIMIT = 1;
const SENTENCE_DOT_OFFSET = 1;

const firstSentence = (body: string): string => {
  const stripped = body.replace(ONELINE_PREFIX, '');
  const [firstParagraph = ''] = stripped.split(/\n\n/u, FIRST_PARAGRAPH_SPLIT_LIMIT);
  const boundary = /\.\s/gu;
  for (let bm = boundary.exec(firstParagraph); bm !== null; bm = boundary.exec(firstParagraph)) {
    const upto = firstParagraph.slice(FALLBACK_ZERO, bm.index + SENTENCE_DOT_OFFSET);
    if (!ABBREVIATION_END.test(upto)) {
      return upto.trim();
    }
  }
  return firstParagraph.trim();
};

export const parseRejected = (markdown: string): RejectedEntry[] =>
  splitByHeading(
    markdown,
    REJECTED_HEADING,
    (line) => line.startsWith('## ') || line.startsWith('# '),
  ).map(({ match, body }) => ({
    id: match.groups?.id ?? '',
    oneline: firstSentence(body),
    slug: match.groups?.slug ?? '',
  }));

export const parseDecisions = (markdown: string): DecisionEntry[] =>
  splitByHeading(
    markdown,
    DECISION_HEADING,
    (line) => line.startsWith('## ') || line.startsWith('# '),
  ).map(({ match, body }) => ({
    id: match.groups?.id ?? '',
    oneline: firstSentence(body),
    title: match.groups?.title ?? '',
  }));

export const parseAxes = (markdown: string): AxisEntry[] =>
  splitByHeading(
    markdown,
    AXIS_HEADING,
    (line) => line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# '),
  ).map(({ match, body }) => ({
    axis: match.groups?.axis ?? '',
    id: match.groups?.num ?? '',
    oneline: firstSentence(body),
  }));

export interface GetEntryOptions {
  readonly kind: 'rejected' | 'decisions' | 'axes';
  readonly id: string;
}

interface HeadingConfig {
  readonly groups: readonly [string, string];
  readonly pattern: RegExp;
  readonly isBoundary: (line: string) => boolean;
}

const HEADING_CONFIG: Record<GetEntryOptions['kind'], HeadingConfig> = {
  axes: {
    groups: ['num', 'axis'],
    isBoundary: (line) =>
      line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# '),
    pattern: AXIS_HEADING,
  },
  decisions: {
    groups: ['id', 'title'],
    isBoundary: (line) => line.startsWith('## ') || line.startsWith('# '),
    pattern: DECISION_HEADING,
  },
  rejected: {
    groups: ['id', 'slug'],
    isBoundary: (line) => line.startsWith('## ') || line.startsWith('# '),
    pattern: REJECTED_HEADING,
  },
};

interface MatchEntryOpts {
  readonly lines: string[];
  readonly config: HeadingConfig;
  readonly needle: string;
  readonly idx: number;
}

const composeSlice = (lines: string[], idx: number, endIdx: number): string => {
  const slice = lines.slice(idx, endIdx).join('\n');
  if (slice.endsWith('\n')) {
    return slice;
  }
  return `${slice}\n`;
};

/**
 * Scan forward from `start` to the next boundary, returning the end index.
 */
const scanToNextBoundary = (
  lines: string[],
  start: number,
  isBoundary: (line: string) => boolean,
): number => {
  let endIdx = start + HEADING_OFFSET;
  while (endIdx < lines.length && !isBoundary(lines[endIdx] ?? '')) {
    endIdx += INDEX_STEP;
  }
  return endIdx;
};

const matchEntryLine = ({ config, idx, lines, needle }: MatchEntryOpts): string | undefined => {
  const match = (lines[idx] ?? '').match(config.pattern);
  if (!match) {
    return;
  }
  const [first, second] = config.groups;
  const candidates = [match.groups?.[first] ?? '', match.groups?.[second] ?? ''].map((str) =>
    str.toLowerCase(),
  );
  if (!candidates.includes(needle)) {
    return;
  }
  return composeSlice(lines, idx, scanToNextBoundary(lines, idx, config.isBoundary));
};

export const getEntryById = (markdown: string, opts: GetEntryOptions): string | undefined => {
  const lines = markdown.split('\n');
  const config = HEADING_CONFIG[opts.kind];
  const needle = opts.id.toLowerCase();
  for (let idx = 0; idx < lines.length; idx += INDEX_STEP) {
    const result = matchEntryLine({ config, idx, lines, needle });
    if (typeof result !== 'undefined') {
      return result;
    }
  }
};

const OBSERVATION_HEADING = /^## (?<date>\d{4}-\d{2}-\d{2}) — (?<axis>[^ ]+) — (?<slug>.+)$/u;

export interface ObservationEntry {
  readonly date: string;
  readonly axis: string;
  readonly slug: string;
  readonly oneline: string;
}

export const parseObservations = (markdown: string): ObservationEntry[] =>
  splitByHeading(
    markdown,
    OBSERVATION_HEADING,
    (line) => line.startsWith('## ') || line.startsWith('# '),
  ).map(({ match, body }) => ({
    axis: match.groups?.axis ?? '',
    date: match.groups?.date ?? '',
    oneline: firstSentence(body),
    slug: match.groups?.slug ?? '',
  }));

export { appendObservation, formatObservationEntry, getObservationBySlug } from './observations.ts';
export { appendLedgerEntry, formatLedgerEntry, nextLedgerId } from './ledger.ts';
export { getStateForAxis, listStateAxes, updateState } from './state.ts';
