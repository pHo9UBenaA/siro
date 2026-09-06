export interface GithubAnnotation {
  readonly command: string;
  readonly props: Readonly<Record<string, string>>;
  readonly body: string;
}

// Property delimiters remain literal; encoded values are intentionally not decoded.
const LINE_RE = /^::(?<command>[a-z][a-z-]*)(?: (?<propString>[^:]*))?::(?<body>.*)$/u;

const parseProps = (raw: string): Record<string, string> => {
  const props: Record<string, string> = {};
  if (raw.length === 0) {
    return props;
  }
  for (const entry of raw.split(',')) {
    const eq = entry.indexOf('=');
    if (eq === -1) {
      throw new Error(`Malformed property in annotation: ${JSON.stringify(entry)}`);
    }
    props[entry.slice(0, eq)] = entry.slice(eq + 1);
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
