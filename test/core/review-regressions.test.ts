import path from 'node:path';
import { asAbsPath, lint, lintCommand, type LintOptions } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { captureIO } from '../helpers/io.ts';

const inspect = (files: Record<string, string>, options: Partial<LintOptions> = {}) =>
  lint({
    cwd: asAbsPath('/repo'),
    fs: createMemFileSystem(files),
    installationRoots: [],
    ...options,
  });

it.each([
  { name: 123 },
  { name: [] },
  { name: {} },
  { publish: 'false' },
  { publish: [] },
  { publish: { include: 3 } },
  { publish: { include: [false] } },
])('rejects malformed consumed Deno metadata before applicability: %j', (manifest) => {
  for (const prefix of ['', 'child/']) {
    expect(() =>
      inspect(
        { [`${prefix}deno.json`]: JSON.stringify(manifest) },
        {
          projectType: 'application',
          config: { rules: { 'files-field': 'off' } },
        },
      ),
    ).toThrow(`${prefix}deno.json`);
  }
});

it.each([
  {},
  { name: null },
  { publish: null },
  { publish: true },
  { publish: false },
  { publish: { include: null, future: true } },
  { name: '@a/b', publish: { include: ['mod.ts'] } },
])('preserves legitimate nullable/boolean Deno metadata and unknown fields: %j', (manifest) => {
  expect(() => inspect({ 'deno.json': JSON.stringify(manifest) })).not.toThrow();
});

it('does not validate excluded malformed metadata', () => {
  expect(
    inspect({ 'child/deno.json': '{"name":123}' }, { exclude: ['child'] }).inspection.manifests,
  ).toEqual([]);
});

it('checks registry ranges in every inline Deno scope and identifies their locations', () => {
  const result = inspect(
    {
      'deno.json': JSON.stringify({
        imports: { x: 'npm:lodash@4.17.21/fp' },
        scopes: {
          './first/': { x: 'npm:lodash@^4/fp' },
          './second/': { x: 'jsr:@std/path@1/posix', blocked: null },
        },
      }),
    },
    { installationRoots: ['.'], pm: 'deno' },
  );
  const finding = result.findings.find((f) => f.ruleId === 'pin-exact-versions');
  expect(finding?.severity).toBe('error');
  expect(finding?.message).toContain('./first/');
  expect(finding?.message).toContain('./second/');
});

it.each([{ imports: [] }, { imports: { x: 3 } }, { scopes: [] }, { scopes: { './x/': false } }])(
  'does not call malformed import maps pinned: %j',
  (config) => {
    expect(() =>
      inspect({ 'deno.json': JSON.stringify(config) }, { installationRoots: ['.'], pm: 'deno' }),
    ).toThrow(/deno.json/);
  },
);

it.each([3, 100_000_000, Number.MAX_SAFE_INTEGER])(
  'uses the same cutoff bounds for Deno days/minutes: %s',
  (days) => {
    const options = { installationRoots: ['.'], pm: 'deno' as const, pmVersion: '2.8.1' };
    const base = { 'deno.json': '{"lock":{"frozen":true}}', 'deno.lock': '{}' };
    const fallback = inspect({ ...base, '.npmrc': `min-release-age=${days}` }, options);
    const explicit = inspect(
      { ...base, 'deno.json': JSON.stringify({ minimumDependencyAge: days * 1440 }) },
      options,
    );
    const violation = (r: ReturnType<typeof lint>) =>
      r.findings.some((f) => f.ruleId === 'minimum-release-age');
    expect(violation(fallback)).toBe(violation(explicit));
    expect(violation(fallback)).toBe(days !== 3);
  },
);

it.each(['11.16.0', '12.0.0', undefined])('handles shrinkwrap honestly for npm %s', (version) => {
  const result = inspect(
    { 'npm-shrinkwrap.json': '{}' },
    {
      installationRoots: ['.'],
      pm: 'npm',
      ...(version ? { pmVersion: version } : {}),
    },
  );
  const finding = result.findings.find((f) => f.ruleId === 'commit-lockfile');
  expect(Boolean(finding)).toBe(version !== '11.16.0');
  expect(finding?.message.includes('npm-shrinkwrap.json')).toBe(
    version === '11.16.0' ? undefined : true,
  );
});

it('gives the GitHub reporter the actual scan root without changing API paths', async () => {
  const options = {
    cwd: asAbsPath(path.resolve('/repo/tools')),
    fs: createMemFileSystem(
      { 'package.json': '{"name":"pkg"}' },
      path.resolve('/repo/tools').replaceAll('\\', '/'),
    ),
    installationRoots: [],
  };
  const { io, out } = captureIO();
  await lintCommand({ ...options, reporter: 'github' }, io);
  expect(out()).toContain(`file=${path.join(options.cwd, 'package.json').replaceAll(':', '%3A')}`);
  expect(lint(options).findings[0]?.file).toBe('package.json');
});

it('awaits a delayed output rejection rather than resolving a clean lint command', async () => {
  const failure = new Error('delayed output failure');
  let reject: (error: Error) => void = () => {};
  const write = new Promise<void>((_resolve, rejectWrite) => {
    reject = rejectWrite;
  });
  // Observe immediately so the red test itself does not create an unhandled rejection.
  void write.catch(() => {});
  const result = lintCommand(
    {
      cwd: asAbsPath('/repo'),
      fs: createMemFileSystem({}),
      installationRoots: [],
      reporter: 'json',
    },
    {
      stdout: () => write,
      stderr() {},
    },
  );
  reject(failure);
  await expect(result).rejects.toBe(failure);
});
