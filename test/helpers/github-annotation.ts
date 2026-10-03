export interface GithubAnnotation {
  readonly command: string;
  readonly props: Readonly<Record<string, string>>;
  readonly body: string;
}

// Split literal delimiters before decoding, exactly once (a literal %0A must survive).
const decode = (value: string, { property = false }: { property?: boolean } = {}): string => {
  const codes: Record<string, string> = {
    '%25': '%',
    '%0D': '\r',
    '%0A': '\n',
    ...(property ? { '%3A': ':', '%2C': ',' } : {}),
  };
  return value.replace(/%[0-9A-F]{2}/giu, (token) => codes[token.toUpperCase()] ?? token);
};
const LINE_RE = /^::(?<command>[a-z][a-z-]*)(?: (?<propString>[^:]*))?::(?<body>.*)$/u;

const parseProps = (raw: string): Record<string, string> => {
  const props: Record<string, string> = {};
  if (raw.length === 0) {
    return props;
  }
  for (const entry of raw.split(',')) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Malformed property in annotation: ${JSON.stringify(entry)}`);
    }
    props[entry.slice(0, separatorIndex)] = decode(entry.slice(separatorIndex + 1), {
      property: true,
    });
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
  return { body: decode(match.groups.body ?? ''), command: match.groups.command ?? '', props };
};
