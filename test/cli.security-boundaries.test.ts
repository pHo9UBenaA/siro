import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createTestProject } from './helpers/temp-project.ts';
import path from 'node:path';
import { isNodeError } from '../src/adapters/node-errors.ts';
import { captureThrown } from './helpers/errors.ts';
import { asAbsPath, ConfigError, lint } from '../src/index.ts';

const cli = path.resolve(import.meta.dirname, '../dist/cli.js');
const createPassingProject = () => {
  const root = createTestProject({});
  cpSync(path.resolve(import.meta.dirname, 'fixtures/npm-good'), root, { recursive: true });
  return root;
};
const run = (root: string, args: string[] = [], command = 'lint', cwd?: string) => {
  const result = spawnSync(process.execPath, [cli, command, root, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
};

it('applies automatic JSON settings, leaves JS configs inert, and honors CLI overrides', () => {
  const root = createPassingProject();
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, 'siro.config.json'),
    JSON.stringify({
      installationRoots: [],
      exclude: ['broken'],
      rules: { 'files-field': 'error' },
    }),
  );
  writeFileSync(
    path.join(root, 'siro.config.mjs'),
    `
    import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    export default {};`,
  );
  mkdirSync(path.join(root, 'child'));
  writeFileSync(path.join(root, 'child/package.json'), '{"name":"child"}');
  writeFileSync(path.join(root, 'child/siro.config.mjs'), "throw new Error('child config');");
  writeFileSync(path.join(root, 'child/siro.config.json'), '{"rules":{"files-field":"off"}}');
  mkdirSync(path.join(root, 'broken'));
  writeFileSync(path.join(root, 'broken/package.json'), '{');
  const result = run(root, ['--json']);
  expect(result.status).toBe(1);
  const report = JSON.parse(result.stdout);
  expect(report.inspection.installationRoots).toEqual([]);
  expect(report.findings).toContainEqual(
    expect.objectContaining({
      ruleId: 'files-field',
      file: 'child/package.json',
      severity: 'error',
    }),
  );
  expect(run(root, ['--exclude', 'child', '--json']).status).toBe(2);
  expect(existsSync(marker)).toBe(false);
});

it('skips even malformed JSON with --no-config', () => {
  const root = createPassingProject();
  writeFileSync(path.join(root, 'siro.config.json'), 'FAKE_SECRET_NOT_JSON');
  expect(run(root, ['--no-config', '--json']).status).toBe(0);
  const result = run(root, ['--json']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('siro.config.json');
  expect(result.stderr).not.toContain('FAKE_SECRET');
});

it('loads an external explicit JSON policy unless strict filesystem requires containment', () => {
  const root = createPassingProject();
  const policyDirectory = createTestProject({ 'policy.json': '{"installationRoots":[]}' });
  const args = ['--config', path.join(policyDirectory, 'policy.json'), '--json'];
  const ordinary = run(root, args);
  expect(ordinary.status).toBe(0);
  expect(JSON.parse(ordinary.stdout).inspection.installationRoots).toEqual([]);
  const strict = run(root, [...args, '--strict-filesystem']);
  expect(strict.status).toBe(2);
  expect(strict.stdout).toBe('');
  expect(strict.stderr).toContain('escapes cwd');
});

it('counts JSON config bytes in the same total budget as inspected files', () => {
  const root = createPassingProject();
  const config = JSON.stringify({ installationRoots: [] }) + ' '.repeat(512);
  writeFileSync(path.join(root, 'siro.config.json'), config);
  const manifestBytes = Buffer.byteLength(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const result = run(root, [
    '--max-total-bytes',
    String(Buffer.byteLength(config) + manifestBytes - 1),
    '--json',
  ]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('maxTotalBytes');
});

it('rejects a directory in place of automatic JSON configuration', () => {
  const root = createPassingProject();
  mkdirSync(path.join(root, 'siro.config.json'));
  const result = run(root, ['--json']);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('siro.config.json');
  expect(result.stdout).toBe('');
});

it('rejects a FIFO JSON config without waiting for a writer', (context) => {
  if (process.platform === 'win32') {
    context.skip();
    return;
  }
  const root = createPassingProject();
  expect(spawnSync('mkfifo', [path.join(root, 'siro.config.json')]).status).toBe(0);
  const result = run(root, ['--json']);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('expected a regular file');
});

it('applies strict filesystem checks to automatic JSON configuration', (context) => {
  const root = createPassingProject();
  const source = path.join(root, 'source.json');
  writeFileSync(source, '{"installationRoots":[]}');
  try {
    symlinkSync(source, path.join(root, 'siro.config.json'));
  } catch (error) {
    if (process.platform === 'win32' && isNodeError(error) && error.code === 'EPERM') {
      context.skip();
      return;
    }
    throw error;
  }
  const ordinary = run(root, ['--json']);
  expect(ordinary.status).toBe(0);
  expect(JSON.parse(ordinary.stdout).inspection.installationRoots).toEqual([]);
  const strict = run(root, ['--strict-filesystem', '--json']);
  expect(strict.status).toBe(2);
  expect(strict.stdout).toBe('');
  expect(strict.stderr).toContain('symlink');
});

it.each(['ts', 'mjs', 'js'])('requires opt-in before evaluating a %s config', (extension) => {
  const root = createPassingProject();
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, `siro.config.${extension}`),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    export default {};`,
  );
  const result = run(root, ['--json']);
  expect(existsSync(marker)).toBe(false);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('--config');
  expect(result.stderr).toContain('--no-config');
});

it('executes only the explicitly selected config, including its custom reporter', () => {
  const root = createPassingProject();
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, 'siro.config.mjs'),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'untrusted');
    export default {};`,
  );
  writeFileSync(path.join(root, 'siro.config.json'), 'invalid automatic settings');
  const config = path.join(root, 'trusted-policy.mjs');
  writeFileSync(
    config,
    `export default { reporters: [{
      name: 'trusted', format(_result, io) { return io.stdout('trusted output'); },
    }] };`,
  );
  const result = run(root, ['--config', config, '--reporter', 'trusted']);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('trusted output\n');
  expect(existsSync(marker)).toBe(false);
});

it('resolves --config relative to the shell directory, not the lint target', () => {
  const root = createPassingProject();
  const shellDirectory = createTestProject({
    'policy.mjs': 'export default { installationRoots: [] };',
  });
  const result = run(root, ['--config', 'policy.mjs', '--json'], 'lint', shellDirectory);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).inspection.installationRoots).toEqual([]);
});

it.each([
  ['--config'],
  ['--config='],
  ['--config', 'policy.mjs', '--config', 'other.mjs'],
  ['--config', 'policy.mjs', '--no-config'],
])('rejects invalid config selection before running code: %s', (...args) => {
  const root = createPassingProject();
  const result = run(root, args);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('--config');
});

it.each(['ts', 'mjs', 'js'])('does not evaluate %s config with --no-config', (extension) => {
  const root = createPassingProject();
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, `siro.config.${extension}`),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    throw new Error('untrusted');`,
  );
  const result = run(root, ['--no-config', '--json'], 'check');
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).schemaVersion).toBe(3);
  expect(existsSync(marker)).toBe(false);
});

it('ignores a non-file config and ignores its exclusions/rules/reporters entirely', () => {
  const root = createPassingProject();
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
  const result = run(root, ['--no-config', '--json']);
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.inspection.manifests).toHaveLength(2);
  expect(report.inspection.installationRoots).toHaveLength(1);
  expect(report.findings).toContainEqual(expect.objectContaining({ ruleId: 'files-field' }));
});

it('validates explicit PM versions before executing trusted config', () => {
  const root = createPassingProject();
  const marker = path.join(root, 'marker');
  writeFileSync(
    path.join(root, 'siro.config.mjs'),
    `import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(marker)}, 'ran');
    export default {};`,
  );
  expect(
    run(root, [
      '--config',
      path.join(root, 'siro.config.mjs'),
      '--pm',
      'npm',
      '--pm-version',
      'invalid',
    ]).status,
  ).toBe(2);
  expect(existsSync(marker)).toBe(false);
});

it('does not wait for config evaluation in data-only mode', () => {
  const root = createPassingProject();
  writeFileSync(path.join(root, 'siro.config.mjs'), 'await new Promise(() => {});');
  expect(run(root, ['--no-config']).status).toBe(0);
});

it.each(
  [['--no-config=true'], ['--no-config', '--no-config'], ['--strict-filesystem=false']].map(
    (args) => ({ args }),
  ),
)('rejects malformed boolean flags: $args', ({ args }) => {
  const root = createPassingProject();
  expect(run(root, args).status).toBe(2);
});

it.each([
  ['package.json', 'FAKE_SECRET_NOT_JSON', 'npm'],
  ['deno.json', 'FAKE_SECRET_NOT_JSON', 'npm'],
  ['.yarnrc.yml', 'enableScripts: [FAKE_SECRET_NOT_YAML', 'yarn'],
  ['bunfig.toml', '[install]\nexact = FAKE_SECRET_NOT_TOML', 'bun'],
] as const)('does not expose parser input from %s in CLI or API diagnostics', (file, text, pm) => {
  const root = createPassingProject();
  writeFileSync(path.join(root, file), text);
  const result = run(root, ['--no-config', '--json', '--pm', pm]);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).not.toContain('FAKE_SECRET');
  expect(result.stderr).toContain(file);
  const failure = captureThrown(() => lint({ cwd: asAbsPath(root), pm }));
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
    const root = createPassingProject();
    writeFileSync(
      path.join(root, 'package.json'),
      '{"name":"public","packageManager":"npm@12.0.2","unknown":{"nested":{}}}',
    );
    mkdirSync(path.join(root, 'a/b'), { recursive: true });
    writeFileSync(path.join(root, 'a/b/package.json'), '{}');
    const result = run(root, ['--no-config', flag, '1', '--json']);
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
  const root = createPassingProject();
  const directory = 'name\n::error title=forged::text##[error]\u001b[2J\u202e';
  mkdirSync(path.join(root, directory));
  writeFileSync(path.join(root, directory, 'package.json'), '{"name":"child"}');
  const json = run(root, ['--no-config', '--json']);
  expect(json.status).toBe(0);
  expect(json.stdout).not.toContain('##[');
  expect(JSON.parse(json.stdout).inspection.manifests).toContainEqual(
    expect.objectContaining({ path: `${directory}/package.json` }),
  );
  const pretty = run(root, ['--no-config']);
  expect(pretty.status).toBe(0);
  expect(pretty.stdout).not.toMatch(/^\s*::/mu);
  expect(pretty.stdout).not.toContain('\u202e');
  const github = run(root, ['--no-config', '--reporter', 'github']);
  expect(github.status).toBe(0);
  const lines = github.stdout.trim().split('\n');
  expect(lines).toHaveLength(JSON.parse(json.stdout).findings.length);
  for (const line of lines) expect(line).toMatch(/^::(?:error|warning|notice) .*title=[\w-]+::/u);
  expect(github.stdout).toContain('%0A');
});

it('rejects file symlinks in strict mode, but retains default resolution', (context) => {
  const root = createPassingProject();
  const file = path.join(root, 'source.npmrc');
  writeFileSync(file, 'ignore-scripts=FAKE_SECRET_POLICY_VALUE');
  rmSync(path.join(root, '.npmrc'));
  try {
    symlinkSync(file, path.join(root, '.npmrc'));
  } catch (error) {
    if (process.platform === 'win32' && isNodeError(error) && error.code === 'EPERM') {
      context.skip();
      return;
    }
    throw error;
  }
  expect(run(root, ['--no-config', '--strict-filesystem', '--json']).status).toBe(2);
  expect(run(root, ['--no-config', '--json']).stdout).toContain('FAKE_SECRET_POLICY_VALUE');
});
