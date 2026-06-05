/**
 * Parse one GitHub Actions workflow command (annotation) line so tests can
 * assert on its structural shape rather than the wire format. Workflow
 * commands look like:
 *
 *   ::<command> <prop>=<value>[,<prop>=<value>...]::<message>
 *
 * Property values are percent-encoded (so commas inside values appear as
 * `%2C` and colons as `%3A`); message bodies only escape control characters.
 * Spec: https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
 *
 * Test code should assert against the parsed `{ command, props, body }`
 * triple instead of regexing the raw line — that way a benign prop-order
 * change can't break tests, and a typo in the prop name can't slip past a
 * loose substring match.
 */
export interface GithubAnnotation {
  readonly command: string;
  readonly props: Readonly<Record<string, string>>;
  readonly body: string;
}

// Command names in the workflow-commands spec include hyphenated forms
// (`set-output`, `add-mask`, …) alongside the annotation triple
// (`error|warning|notice`), so the leading capture admits hyphens.
//
// `[^:]*` for the prop string is safe because the spec — and `githubReporter`
// in particular — percent-encodes both `:` and `,` inside property values,
// so any literal colon must be the start of the `::body` separator.
const LINE_RE = /^::(?<command>[a-z][a-z-]*)(?: (?<propString>[^:]*))?::(?<body>.*)$/u;

const EMPTY = 0;
const NOT_FOUND = -1;
const AFTER_SEPARATOR = 1;

const parseProps = (raw: string): Record<string, string> => {
  const props: Record<string, string> = {};
  if (raw.length === EMPTY) {
    return props;
  }
  for (const entry of raw.split(',')) {
    const eq = entry.indexOf('=');
    if (eq === NOT_FOUND) {
      throw new Error(`Malformed property in annotation: ${JSON.stringify(entry)}`);
    }
    props[entry.slice(EMPTY, eq)] = entry.slice(eq + AFTER_SEPARATOR);
  }
  return props;
};

export const parseGithubAnnotation = (line: string): GithubAnnotation => {
  const trimmed = line.replace(/\r?\n$/u, '');
  const match = LINE_RE.exec(trimmed);
  if (!match || !match.groups) {
    throw new Error(`Unparseable GitHub annotation line: ${JSON.stringify(line)}`);
  }
  const props = parseProps(match.groups.propString ?? '');
  return { body: match.groups.body ?? '', command: match.groups.command ?? '', props };
};
