// Observation-related functions for OBSERVATIONS.md. Extracted from ctx.ts.

const THIRD_CAPTURE = 3;
const HEADING_OFFSET = 1;
const EMPTY_LENGTH = 0;
const LAST_ELEMENT = -1;
const FALLBACK_ZERO = 0;
const INDEX_STEP = 1;

const OBSERVATION_HEADING = /^## (?<date>\d{4}-\d{2}-\d{2}) — (?<axis>[^ ]+) — (?<slug>.+)$/u;

export interface ObservationInput {
  readonly date: string;
  readonly axis: string;
  readonly slug: string;
  readonly note: string;
  readonly file?: string;
}

const MD_CONTROL = /[\n\r]/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const WHITESPACE_RE = /\s/u;
const HEADING_IN_BODY = /^##? /mu;

const validateObservationInput = (input: ObservationInput): void => {
  if (!ISO_DATE.test(input.date)) {
    throw new Error(`observation date must be YYYY-MM-DD: ${JSON.stringify(input.date)}`);
  }
  if (MD_CONTROL.test(input.slug)) {
    throw new Error(`observation slug must not contain newlines: ${JSON.stringify(input.slug)}`);
  }
  if (WHITESPACE_RE.test(input.axis)) {
    throw new Error(`observation axis must not contain whitespace: ${JSON.stringify(input.axis)}`);
  }
  if (HEADING_IN_BODY.test(input.note)) {
    throw new Error('observation note must not contain lines starting with "# " or "## "');
  }
  if (typeof input.file !== 'undefined' && MD_CONTROL.test(input.file)) {
    throw new Error(
      `observation file ref must not contain newlines: ${JSON.stringify(input.file)}`,
    );
  }
};

export const formatObservationEntry = (input: ObservationInput): string => {
  validateObservationInput(input);
  const heading = `## ${input.date} — ${input.axis} — ${input.slug}`;
  let fileRef = '';
  if (input.file) {
    fileRef = `\n\`${input.file}\`\n`;
  }
  return `${heading}\n\n${input.note.trim()}\n${fileRef}`;
};

export const appendObservation = (currentMd: string, entry: string): string => {
  const trimmedEnd = currentMd.replace(/\n+$/u, '');
  if (trimmedEnd === '') {
    return entry;
  }
  return `${trimmedEnd}\n\n${entry}`;
};

const findObservationTargets = (lines: string[], slug: string): number[] => {
  const targets: number[] = [];
  for (let idx = 0; idx < lines.length; idx += INDEX_STEP) {
    const match = (lines[idx] ?? '').match(OBSERVATION_HEADING);
    if (match && match[THIRD_CAPTURE] === slug) {
      targets.push(idx);
    }
  }
  return targets;
};

/**
 * Scan from `start` to the next heading boundary, returning the end index.
 */
const findEndOfEntry = (lines: string[], start: number): number => {
  let end = start + HEADING_OFFSET;
  while (
    end < lines.length &&
    !((lines[end] ?? '').startsWith('## ') || (lines[end] ?? '').startsWith('# '))
  ) {
    end += INDEX_STEP;
  }
  return end;
};

export const getObservationBySlug = (markdown: string, slug: string): string | undefined => {
  const lines = markdown.split('\n');
  const targets = findObservationTargets(lines, slug);
  if (targets.length === EMPTY_LENGTH) {
    return;
  }
  const start = targets.at(LAST_ELEMENT) ?? FALLBACK_ZERO;
  const end = findEndOfEntry(lines, start);
  const slice = lines.slice(start, end).join('\n');
  if (slice.endsWith('\n')) {
    return slice;
  }
  return `${slice}\n`;
};
