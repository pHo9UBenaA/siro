import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { asAbsPath, ConfigError, lint } from '../src/index.ts';

const cli = path.resolve(import.meta.dirname, '../dist/cli.js');
let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'siro-security-'));
  cpSync(path.resolve(import.meta.dirname, 'fixtures/npm-good'), root, { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const run = (args: string[] = [], command = 'lint') => {
  const result = spawnSync(process.execPath, [cli, command, root, ...args], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
};

it.each(['ts', 'mjs', 'js'])('does not evaluate %s config with --no-config', (extension) => {
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, `siro.config.${extension}`),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    throw new Error('untrusted');`,
  );
  const result = run(['--no-config', '--json'], 'check');
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).schemaVersion).toBe(3);
  expect(existsSync(marker)).toBe(false);
});

it('ignores a non-file config and ignores its exclusions/rules/reporters entirely', () => {
  mkdirSync(path.join(root, 'siro.config.ts'));
  writeFileSync(
    path.join(root, 'siro.config.mjs'),
    `export default {
      installationRoots: [],
      exclude: ['child'],
      rules: { 'files-field': 'off' },
      reporters: [{ name: 'json', format() { throw new Error('ran'); } }],
    };`,
  );
  mkdirSync(path.join(root, 'child'));
  writeFileSync(path.join(root, 'child/package.json'), '{"name":"child"}');
  const result = run(['--no-config', '--json']);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.inspection.manifests).toHaveLength(2);
  expect(report.inspection.installationRoots).toHaveLength(1);
  expect(report.findings).toContainEqual(expect.objectContaining({ ruleId: 'files-field' }));
});

it('validates explicit PM versions before executing trusted config', () => {
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, 'siro.config.mjs'),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    export default {};`,
  );
  expect(run(['--pm', 'npm', '--pm-version', 'invalid']).status).toBe(2);
  expect(existsSync(marker)).toBe(false);
});

it('does not wait for config evaluation in data-only mode', () => {
  writeFileSync(path.join(root, 'siro.config.mjs'), 'await new Promise(() => {});');
  expect(run(['--no-config']).status).toBe(0);
});

it.each(
  [['--no-config=true'], ['--no-config', '--no-config'], ['--strict-filesystem=false']].map(
    (args) => ({ args }),
  ),
)('rejects malformed boolean flags: $args', ({ args }) => {
  expect(run(args).status).toBe(2);
});

it.each([
  ['package.json', 'FAKE_SECRET_NOT_JSON', 'npm'],
  ['deno.json', 'FAKE_SECRET_NOT_JSON', 'npm'],
  ['.yarnrc.yml', 'enableScripts: [FAKE_SECRET_NOT_YAML', 'yarn'],
  ['bunfig.toml', '[install]\nexact = FAKE_SECRET_NOT_TOML', 'bun'],
] as const)('does not expose parser input from %s in CLI or API diagnostics', (file, text, pm) => {
  writeFileSync(path.join(root, file), text);
  const result = run(['--no-config', '--json', '--pm', pm]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).not.toContain('FAKE_SECRET');
  expect(result.stderr).toContain(file);
  let failure: unknown;
  try {
    lint({ cwd: asAbsPath(root), pm });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ConfigError);
  expect(String(failure)).toMatch(/invalid|Invalid/);
  expect(String(failure)).toContain(file);
  expect(String(failure)).not.toContain('FAKE_SECRET');
});

const scopeAdvice =
  'Reduce the scan scope. If the target contains independent projects, scan each project directory separately.';

it.each([
  [
    '--max-file-bytes',
    'Inspection exceeds maxFileBytes (1).',
    'Reduce the size of the input file.',
    2,
  ],
  ['--max-total-bytes', 'Inspection exceeds maxTotalBytes (1).', scopeAdvice, 2],
  ['--max-entries', 'Inspection exceeds maxEntries (1).', scopeAdvice, 2],
  ['--max-directories', 'Inspection exceeds maxDirectories (1).', scopeAdvice, 2],
  ['--max-directory-depth', 'Inspection exceeds maxDirectoryDepth (1).', scopeAdvice, 2],
  [
    '--max-config-depth',
    'Configuration exceeds maxConfigDepth (1).',
    'Simplify the nesting of the configuration.',
    2,
  ],
  ['--max-findings', 'Inspection exceeds maxFindings (1).', scopeAdvice, 2],
  ['--max-output-bytes', 'Output exceeds maxOutputBytes (1).', scopeAdvice, 70],
] as const)(
  'explains how to address %s without emitting a partial JSON report',
  (flag, message, advice, code) => {
    writeFileSync(
      path.join(root, 'package.json'),
      '{"name":"public","packageManager":"npm@12.0.2","unknown":{"nested":{}}}',
    );
    mkdirSync(path.join(root, 'a/b'), { recursive: true });
    writeFileSync(path.join(root, 'a/b/package.json'), '{}');
    const result = run(['--no-config', flag, '1', '--json']);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(code);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(`${message} ${advice}\n`);
  },
);

it('encodes hostile filenames without injecting additional workflow commands', (context) => {
  if (process.platform === 'win32') {
    context.skip();
    return;
  }
  const directory = 'name\n::error title=forged::text##[error]\u001b[2J\u202e';
  mkdirSync(path.join(root, directory));
  writeFileSync(path.join(root, directory, 'package.json'), '{"name":"child"}');
  const json = run(['--no-config', '--json']);
  expect(json.status).toBe(0);
  expect(json.stdout).not.toContain('##[');
  expect(JSON.parse(json.stdout).inspection.manifests).toContainEqual(
    expect.objectContaining({ path: `${directory}/package.json` }),
  );
  const pretty = run(['--no-config']);
  expect(pretty.status).toBe(0);
  expect(pretty.stdout).not.toMatch(/^\s*::/mu);
  expect(pretty.stdout).not.toContain('\u202e');
  const github = run(['--no-config', '--reporter', 'github']);
  expect(github.status).toBe(0);
  const lines = github.stdout.trim().split('\n');
  expect(lines).toHaveLength(JSON.parse(json.stdout).findings.length);
  for (const line of lines) expect(line).toMatch(/^::(?:error|warning|notice) .*title=[\w-]+::/u);
  expect(github.stdout).toContain('%0A');
});

it('rejects file symlinks in strict mode, but retains default resolution', (context) => {
  const file = path.join(root, 'source.npmrc');
  writeFileSync(file, 'ignore-scripts=FAKE_SECRET_POLICY_VALUE');
  rmSync(path.join(root, '.npmrc'));
  try {
    symlinkSync(file, path.join(root, '.npmrc'));
  } catch (error) {
    if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') {
      context.skip();
      return;
    }
    throw error;
  }
  expect(run(['--no-config', '--strict-filesystem', '--json']).status).toBe(2);
  expect(run(['--no-config', '--json']).stdout).toContain('FAKE_SECRET_POLICY_VALUE');
});
