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
import { asAbsPath, lint } from '../src/index.ts';

const cli = path.resolve(import.meta.dirname, '../dist/cli.js');
let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'siro-security-'));
  cpSync(path.resolve(import.meta.dirname, 'fixtures/npm-good'), root, { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const run = (args: string[] = [], command = 'lint') =>
  spawnSync(process.execPath, [cli, command, root, ...args], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });

it.each(['ts', 'mjs', 'js'])('does not evaluate %s config with --no-config', (extension) => {
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, `siro.config.${extension}`),
    `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'ran'); throw new Error('untrusted');`,
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
    "export default {installationRoots:[], exclude:['child'], rules:{'files-field':'off'}, reporters:[{name:'json',format(){throw new Error('ran')}}]};",
  );
  mkdirSync(path.join(root, 'child'));
  writeFileSync(path.join(root, 'child/package.json'), '{"name":"child"}');
  const result = run(['--no-config', '--json']);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.inspection.manifests).toHaveLength(2);
  expect(report.inspection.installationRoots).toHaveLength(1);
  expect(report.findings.some((f: { ruleId: string }) => f.ruleId === 'files-field')).toBe(true);
});

it('validates explicit PM versions before executing trusted config', () => {
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, 'siro.config.mjs'),
    `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'ran'); export default {};`,
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
  ['package.json', 'FAKE_SECRET_NOT_JSON'],
  ['deno.json', 'FAKE_SECRET_NOT_JSON'],
  ['.yarnrc.yml', 'enableScripts: [FAKE_SECRET_NOT_YAML'],
  ['bunfig.toml', '[install]\nexact = FAKE_SECRET_NOT_TOML'],
])('does not expose parser input from %s in CLI or API diagnostics', (file, text) => {
  writeFileSync(path.join(root, file), text);
  const pm = file === '.yarnrc.yml' ? 'yarn' : file === 'bunfig.toml' ? 'bun' : 'npm';
  const result = run(['--no-config', '--json', '--pm', pm]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).not.toContain('FAKE_SECRET');
  expect(result.stderr).toContain(file);
  const inspect = () => lint({ cwd: asAbsPath(root), pm: pm as 'npm' });
  expect(inspect).toThrow(/invalid|Invalid/);
  let diagnostic = '';
  try {
    inspect();
  } catch (error) {
    diagnostic = String(error);
  }
  expect(diagnostic).not.toContain('FAKE_SECRET');
});

it('fails closed on small file/output limits through the real CLI', () => {
  const input = run(['--no-config', '--max-file-bytes', '8', '--json']);
  expect(input.status).toBe(2);
  expect(input.stdout).toBe('');
  const output = run(['--no-config', '--max-output-bytes', '8', '--json']);
  expect(output.status).toBe(70);
  expect(output.stdout).toBe('');
});

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
  expect(
    JSON.parse(json.stdout).inspection.manifests.some(
      (m: { path: string }) => m.path === `${directory}/package.json`,
    ),
  ).toBe(true);
  const pretty = run(['--no-config']);
  expect(pretty.stdout).not.toMatch(/^\s*::/mu);
  expect(pretty.stdout).not.toContain('\u202e');
  const github = run(['--no-config', '--reporter', 'github']);
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
