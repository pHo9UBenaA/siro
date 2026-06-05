import path from 'node:path';
import { readFileSync } from 'node:fs';

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const readFileSafe = (pkgPath: string): string => {
  try {
    return readFileSync(pkgPath, 'utf8');
  } catch (error) {
    throw new Error(`package.json could not be read at ${pkgPath} — ${describeError(error)}`, {
      cause: error,
    });
  }
};

const parseJsonSafe = (text: string, pkgPath: string): unknown => {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`package.json at ${pkgPath} is not valid JSON — ${describeError(error)}`, {
      cause: error,
    });
  }
};

const extractVersionField = (pkg: unknown, pkgPath: string): string => {
  if (!pkg || typeof pkg !== 'object' || !('version' in pkg) || typeof pkg.version !== 'string') {
    throw new Error(`package.json at ${pkgPath} has no string \`version\` field`);
  }
  return pkg.version;
};

const validateVersion = (version: string, pkgPath: string): void => {
  if (version === '') {
    throw new Error(`package.json at ${pkgPath} has an empty \`version\` field`);
  }
  // Defend against a malformed or accidentally-escaped version string before
  // it gets interpolated into the generated TS module. SemVer characters
  // (digits, ASCII letters, `.`, `+`, `-`) cover legitimate inputs; anything
  // outside this set — single quotes, newlines, backslashes — would either
  // break the generated module's syntax or smuggle executable code into the
  // jiti-transformed output. Fail loud at read time instead of generating a
  // broken version.ts.
  if (!/^[0-9a-zA-Z.+-]+$/u.test(version)) {
    throw new Error(
      `package.json at ${pkgPath} has a \`version\` field with disallowed characters: ${JSON.stringify(version)}. Expected the SemVer character set [0-9a-zA-Z.+-].`,
    );
  }
};

/**
 * Read the `version` field from the repo's package.json. Wraps every
 * recoverable failure — missing file, malformed JSON, non-string version
 * — in a single `Error` whose message starts with `package.json:` so the
 * caller can surface a uniform diagnostic without sniffing errno codes.
 */
export const readPackageVersion = (root: string): string => {
  const pkgPath = path.join(root, 'package.json');
  const raw = readFileSafe(pkgPath);
  const pkg = parseJsonSafe(raw, pkgPath);
  const version = extractVersionField(pkg, pkgPath);
  validateVersion(version, pkgPath);
  return version;
};

/**
 * Render the src/version.ts module body. Single-quoted literal because
 * oxfmt's single-quote setting would otherwise reformat `JSON.stringify`
 * output. `readPackageVersion` rejects any non-SemVer character set
 * upstream, so plain interpolation is safe by checked invariant rather
 * than by trust in package.json's contents.
 */
export const renderVersionModule = (version: string): string =>
  `// Auto-generated from package.json by scripts/gen/version.mjs.\nexport const version = '${version}';\n`;
