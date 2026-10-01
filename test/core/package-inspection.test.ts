import { asAbsPath, lint, lintCommand, CONFIG_FILES, type LintOptions } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { captureIO } from '../helpers/io.ts';

const inspect = (files: Record<string, string>, options: Partial<LintOptions> = {}) =>
  lint({
    cwd: asAbsPath('/repo'),
    fs: createMemFileSystem(files),
    installationRoots: [],
    ...options,
  });
const json = JSON.stringify;
const packageFindings = (result: ReturnType<typeof lint>) =>
  result.findings.filter((f) => ['files-field', 'publish-access'].includes(f.ruleId));

it('discovers every manifest independently of PM declarations, names, privacy, vendor and nesting', () => {
  const files = {
    'package.json': json({ private: true, workspaces: ['no-match', '!packages/**'] }),
    'deno.json': json({ name: '@test/root', workspace: ['missing'], vendor: true }),
    'packages/a/package.json': json({ name: 'same' }),
    'packages/b/package.json': json({ name: 'same' }),
    'vendor/deno.json': json({ name: '@test/vendor' }),
    'dist/package.json': json({ name: 'built' }),
    'test/fixtures/package.json': json({ name: 'fixture' }),
    'node_modules/bad/package.json': 'invalid',
    '.git/package.json': 'invalid',
  };
  const first = inspect(files);
  const second = inspect({
    ...files,
    'package.json': json({ private: true, workspaces: false }),
    'deno.json': json({ name: '@test/root', workspace: { invalid: true } }),
  });
  expect(first.inspection).toEqual(second.inspection);
  expect(first.inspection.manifests).toHaveLength(7);
  expect(first.summary).toEqual({ error: 0, warn: 0, info: 10 });
  expect(packageFindings(first).map((f) => f.file)).toContain('deno.json');
  expect(packageFindings(first).map((f) => f.file)).not.toContain('package.json');
  expect(packageFindings(first).every((f) => f.pm === undefined)).toBe(true);
  expect(packageFindings(inspect(files, { projectType: 'application' }))).toEqual([]);
});

it('keeps discovery separate from local installation policy and rebases every automatic operation', () => {
  const files = {
    'package.json': '{"private":true,"packageManager":"pnpm@11.7.0"}',
    'child/package.json': '{"name":"child","packageManager":"npm@12.0.2"}',
    'child/.npmrc': 'ignore-scripts=false\n',
  };
  const first = inspect(files, { installationRoots: ['.'] });
  expect(first.inspection.installationRoots.map((r) => r.directory)).toEqual(['.']);
  expect(
    first.findings
      .filter((f) => f.directory === 'child')
      .every((f) => ['files-field', 'publish-access'].includes(f.ruleId)),
  ).toBe(true);
  const result = inspect(files, {
    installationRoots: ['.', 'child'],
    pm: 'pnpm',
    pmVersion: '10.0.0',
    config: { pmVersions: { npm: '1.0.0' } },
  });
  expect(result.inspection.installationRoots).toEqual([
    { directory: '.', targets: [{ pm: 'pnpm', version: '10.0.0' }] },
    { directory: 'child', targets: [{ pm: 'npm', version: '12.0.2' }] },
  ]);
  const finding = result.findings.find(
    (f) => f.directory === 'child' && f.ruleId === 'block-exotic-subdeps',
  );
  expect(finding).toMatchObject({
    file: 'child/.npmrc',
    remediation: {
      kind: 'automatic',
      operations: [
        { file: { path: 'child/.npmrc' }, keyPath: ['allow-git'] },
        { file: { path: 'child/.npmrc' }, keyPath: ['allow-remote'] },
      ],
    },
  });
});

it('uses each manifest local version, not the root version, and does not parse child install config', () => {
  const result = inspect(
    {
      'package.json': '{"packageManager":"npm@9.4.0","publishConfig":{"provenance":true}}',
      'new/package.json':
        '{"name":"new","packageManager":"npm@12.0.2","publishConfig":{"provenance":true}}',
      'unknown/package.json':
        '{"name":"unknown","publishConfig":{"access":"private","provenance":true}}',
      'unknown/pnpm-workspace.yaml': 'invalid: [',
    },
    { pm: 'npm', pmVersion: '9.4.0' },
  );
  expect(
    result.findings.filter((f) => f.ruleId === 'unsupported-settings').map((f) => f.file),
  ).toEqual(['package.json']);
  expect(
    result.inspection.manifests.find((m) => m.path === 'unknown/package.json')?.targets,
  ).toEqual([]);
  expect(result.inspection.installationRoots).toEqual([]);
  expect(
    result.findings.find((f) => f.file === 'unknown/package.json' && f.ruleId === 'publish-access'),
  ).not.toHaveProperty('pm');
});

it('evaluates a directory only once even when an injected enumeration repeats its name', () => {
  const fs = createMemFileSystem({
    'child/package.json': '{"name":"child","packageManager":"npm@12.0.2"}',
  });
  const enumerate = fs.readDirectories;
  fs.readDirectories = (directory) => [...enumerate(directory), ...enumerate(directory)];
  const result = inspect({}, { fs, installationRoots: ['child'] });
  expect(result.inspection.manifests.map((manifest) => manifest.path)).toEqual([
    'child/package.json',
  ]);
  expect(result.inspection.installationRoots.map((root) => root.directory)).toEqual(['child']);
  expect(result.findings.filter((finding) => finding.ruleId === 'files-field')).toHaveLength(1);
});

it('common checks run once across multiple detected PMs; manifest availability has one owner', () => {
  const result = inspect(
    {
      'package.json':
        '{"name":"pkg","packageManager":"npm@9.4.0","publishConfig":{"provenance":true}}',
      'pnpm-lock.yaml': '',
      '.npmrc': 'provenance=true',
    },
    { installationRoots: ['.'] },
  );
  expect(result.findings.filter((f) => f.ruleId === 'files-field')).toHaveLength(1);
  expect(result.findings.filter((f) => f.ruleId === 'publish-access')).toHaveLength(1);
  expect(
    result.findings
      .filter((f) => f.ruleId === 'unsupported-settings')
      .map((f) => f.file)
      .sort(),
  ).toEqual(['.npmrc', 'package.json']);
});

it('identifies the additional root when local installation configuration is malformed', () => {
  expect(() =>
    inspect(
      { 'tool/bunfig.toml': 'install = [' },
      { installationRoots: [{ path: 'tool', pm: 'bun' }] },
    ),
  ).toThrow(/tool\/bunfig.toml/);
});

it('explicit roots can have no manifest and use a local explicit PM/version', () => {
  const result = inspect(
    { 'tool/.npmrc': '' },
    { installationRoots: [{ path: 'tool', pm: 'npm', pmVersion: '12.0.2' }] },
  );
  expect(result.inspection.manifests).toEqual([]);
  expect(result.inspection.installationRoots).toEqual([
    { directory: 'tool', targets: [{ pm: 'npm', version: '12.0.2' }] },
  ]);
  expect(result.findings.some((f) => f.directory === 'tool')).toBe(true);
});

it.each(['fixtures', 'fixtures/**', '**/fixtures/**'])(
  'excludes %s before reading invalid manifests or enumerating children',
  (pattern) => {
    const fs = createMemFileSystem({
      'fixtures/package.json': 'invalid',
      'ok/package.json': '{"name":"ok"}',
    });
    const read = fs.readText;
    const enumerate = fs.readDirectories;
    fs.readText = (file) => {
      if (file.includes('/fixtures/')) throw new Error('excluded read');
      return read(file);
    };
    fs.readDirectories = (directory) => {
      if (directory.endsWith('/fixtures')) throw new Error('excluded enumeration');
      return enumerate(directory);
    };
    expect(inspect({}, { fs, exclude: [pattern] }).inspection.manifests.map((m) => m.path)).toEqual(
      ['ok/package.json'],
    );
  },
);

it('supports only *, ?, whole-component **; punctuation is literal and matching is case-sensitive', () => {
  const result = inspect(
    {
      '[abc]/package.json': 'invalid',
      '{one,two}/package.json': 'invalid',
      '@(x)/package.json': 'invalid',
      '.hidden/package.json': '{"name":"dot"}',
      'Case/package.json': '{"name":"case"}',
    },
    { exclude: ['[abc]', '{one,two}', '@(x)', 'case'] },
  );
  expect(result.inspection.manifests.map((m) => m.path)).toEqual([
    '.hidden/package.json',
    'Case/package.json',
  ]);
  expect(
    inspect(
      { 'package.json': '{}', 'child/package.json': 'invalid' },
      { exclude: ['**'] },
    ).inspection.manifests.map((m) => m.path),
  ).toEqual(['package.json']);
});

it.each([
  { exclude: ['.'] },
  { exclude: ['!child'] },
  { exclude: ['../outside'] },
  { exclude: ['a\\b'] },
  { exclude: null },
  { installationRoots: ['missing'] },
  { installationRoots: ['../outside'] },
  { installationRoots: ['node_modules'] },
  { installationRoots: [{ path: '.', pm: 'npm' }] },
  { installationRoots: [{ path: 'child', pmVersion: '12.0.2' }] },
  { installationRoots: ['child', { path: './child', pm: 'npm' }] },
  { installationRoots: ['child'], exclude: ['child'] },
  { installationRoots: [{ path: 'child', typo: true }] },
  { installationRoots: null },
  { workspaces: false },
])('rejects invalid scope %j', (options) => {
  expect(() =>
    inspect({ 'child/package.json': '{}', 'node_modules/package.json': '{}' }, options as never),
  ).toThrow(/exclude|installation|workspaces|pmVersion/iu);
});

it('keeps final output stable across directory enumeration orders and treats installation wildcards literally', () => {
  const files = {
    'literal*/package.json': '{"name":"literal","packageManager":"npm@12.0.2"}',
    'other/package.json': '{"name":"other"}',
  };
  const fs = createMemFileSystem(files);
  const enumerate = fs.readDirectories;
  const options = { fs, installationRoots: ['literal*'] };
  const first = inspect({}, options);
  fs.readDirectories = (directory) => [...enumerate(directory)].reverse();
  expect(inspect({}, options)).toEqual(first);
  expect(first.inspection.installationRoots.map((root) => root.directory)).toEqual(['literal*']);
});

it('guards an old additional root remedy before cwd-relative rebasing', () => {
  const result = inspect(
    {
      'tool/package.json': '{"name":"tool","publishConfig":{"provenance":false}}',
      'tool/.npmrc': 'provenance=true',
    },
    {
      installationRoots: [{ path: 'tool', pm: 'npm', pmVersion: '9.4.0' }],
    },
  );
  expect(result.findings.find((f) => f.ruleId === 'provenance')).toMatchObject({
    directory: 'tool',
    file: 'tool/package.json',
    remediation: {
      kind: 'manual',
      steps: expect.arrayContaining([expect.stringContaining('npm >=9.5.0')]),
    },
  });
  expect(
    result.findings
      .filter((f) => f.ruleId === 'unsupported-settings')
      .map((f) => f.file)
      .sort(),
  ).toEqual(['tool/.npmrc', 'tool/package.json']);
});

it('normalizes identical literal roots and replaces config arrays rather than merging', () => {
  const result = inspect(
    { 'child/package.json': '{"name":"child"}', 'ignored/package.json': 'invalid' },
    {
      exclude: ['ignored'],
      installationRoots: [
        { path: './child/', pm: 'npm' },
        { path: 'child', pm: 'npm' },
      ],
      config: { exclude: ['child'], installationRoots: ['.'] },
    },
  );
  expect(result.inspection.installationRoots.map((r) => r.directory)).toEqual(['child']);
});

it.each([
  ['bad/package.json', '{'],
  ['bad/deno.json', '[1]'],
  ['bad/deno.jsonc', '{}'],
])('fails selected malformed/unsupported input %s without reporting', async (file, text) => {
  const { io, out } = captureIO();
  await expect(
    lintCommand(
      {
        cwd: asAbsPath('/repo'),
        fs: createMemFileSystem({ [file]: text }),
        installationRoots: [],
        reporter: 'json',
      },
      io,
    ),
  ).rejects.toThrow(file.split('/')[0]);
  expect(out()).toBe('');
});

it.each([undefined, 'not-array', ['..'], ['.'], [''], ['a/b'], [null], Array(1)])(
  'rejects missing or malformed enumeration: %j',
  (names) => {
    const fs = createMemFileSystem({});
    fs.readDirectories = names === undefined ? (undefined as never) : () => names as never;
    expect(() => inspect({}, { fs })).toThrow(/FileSystem.readDirectories/);
  },
);

it('propagates enumeration/read errors, never emits successful partial results', async () => {
  const failure = new Error('EACCES selected');
  const fs = createMemFileSystem({ 'child/package.json': '{}' });
  fs.readDirectories = () => {
    throw failure;
  };
  const { io, out } = captureIO();
  await expect(
    lintCommand({ cwd: asAbsPath('/repo'), fs, installationRoots: [], reporter: 'json' }, io),
  ).rejects.toBe(failure);
  expect(out()).toBe('');
});

it('custom rules run only at cwd, and all-off custom rules do not require a PM', () => {
  const roots: string[] = [];
  const custom = {
    id: 'custom',
    title: 't',
    description: 'd',
    severity: 'warn' as const,
    bindings: {
      npm: {
        check: (ctx: { root: string }) => {
          roots.push(ctx.root);
          return { state: 'ok' as const };
        },
      },
    },
  };
  inspect(
    { 'child/package.json': '{"packageManager":"npm@12.0.2"}' },
    { pm: 'npm', installationRoots: ['child'], config: { customRules: [custom] } },
  );
  expect(roots).toHaveLength(1);
  expect(() => inspect({}, { config: { customRules: [custom] } })).toThrow(/No package manager/);
  expect(() =>
    inspect({}, { config: { customRules: [custom], rules: { custom: 'off' } } }),
  ).not.toThrow();
});

it('shares successful manifest reads within a run but not across calls', () => {
  const fs = createMemFileSystem({
    'package.json':
      '{"name":"first","packageManager":"npm@9.4.0","publishConfig":{"provenance":true}}',
  });
  const read = fs.readText;
  let count = 0;
  fs.readText = (file) =>
    file.endsWith('package.json') && ++count > 1
      ? '{"private":true,"packageManager":"npm@12.0.2"}'
      : read(file);
  const result = inspect({}, { fs, installationRoots: ['.'] });
  expect(count).toBe(1);
  expect(
    result.findings.filter((f) => f.ruleId === 'unsupported-settings').map((f) => f.file),
  ).toContain('package.json');
  expect(packageFindings(inspect({}, { fs, installationRoots: ['.'] }))).toEqual([]);
});

it('npm provenance remedy changes the overriding manifest leaf, preserving sibling settings', () => {
  const pkg = { name: 'pkg', publishConfig: { access: 'public', provenance: false } };
  const files = { 'package.json': json(pkg), '.npmrc': 'provenance=true' };
  const result = inspect(files, { installationRoots: ['.'], pm: 'npm', pmVersion: '12.0.2' });
  const finding = result.findings.find((f) => f.ruleId === 'provenance');
  expect(finding).toMatchObject({ file: 'package.json', actual: false });
  const remedy = finding?.remediation;
  expect(remedy?.kind).toBe('automatic');
  if (remedy?.kind !== 'automatic') throw new Error('expected remedy');
  for (const operation of remedy.operations) {
    expect(operation.file).toEqual(CONFIG_FILES.packageJson);
    expect(operation.keyPath).toEqual(['publishConfig', 'provenance']);
    pkg.publishConfig.provenance = operation.value === true;
  }
  const rerun = inspect(
    { ...files, 'package.json': json(pkg) },
    { installationRoots: ['.'], pm: 'npm' },
  );
  expect(rerun.findings.filter((f) => f.ruleId === 'provenance')).toEqual([]);
  expect(pkg.publishConfig.access).toBe('public');
});

it.each([null, 'true', [], {}])('rejects malformed consumed provenance %j', (provenance) => {
  expect(() => inspect({ 'package.json': json({ publishConfig: { provenance } }) })).toThrow(
    /provenance/,
  );
});
