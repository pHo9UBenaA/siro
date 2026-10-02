import path from 'node:path';
import { lint, lintCommand, asAbsPath } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import {
  BUILTIN_REPORTER_NAMES,
  createRegistry,
  githubReporter,
  jsonReporter,
  prettyReporter,
} from '../../src/adapters/reporters/registry.ts';
import { type LintResult } from '../../src/core/contracts/lint-result.ts';
import { parseGithubAnnotation } from '../helpers/github-annotation.ts';
import { captureIO } from '../helpers/io.ts';

const context = { cwd: asAbsPath(path.resolve('/reporter-fixture')) };
const inspection = { manifests: [], installationRoots: [] };
const result: LintResult = {
  inspection,
  findings: [
    {
      directory: '.',
      file: '.npmrc',
      message: 'set ignore-scripts',
      pm: 'npm',
      ruleId: 'disable-lifecycle-scripts',
      severity: 'error',
      docs: 'https://example.com/guide',
    },
  ],
  summary: { error: 1, info: 0, warn: 0 },
};
afterEach(() => vi.unstubAllEnvs());

it('registers built-ins and allows later custom replacements', () => {
  expect(BUILTIN_REPORTER_NAMES).toEqual(['pretty', 'json', 'github']);
  expect(createRegistry().get('pretty')).toBe(prettyReporter);
  expect(createRegistry().get('json')).toBe(jsonReporter);
  expect(createRegistry().get('github')).toBe(githubReporter);
  const noop = { name: 'noop', format() {} };
  const override = { name: 'pretty', format() {} };
  const registry = createRegistry([noop, override]);
  expect(registry.get('noop')).toBe(noop);
  expect(registry.get('pretty')).toBe(override);
  expect([...registry.keys()]).toEqual(['pretty', 'json', 'github', 'noop']);
});

it('escapes GitHub properties/data and resolves file paths against the supplied scan root', async () => {
  const file = 'path/with,colon:%file.txt';
  const { io, out } = captureIO();
  await githubReporter.format(
    {
      ...result,
      findings: [
        {
          ...result.findings[0]!,
          file,
          message: 'set foo=bar, baz: 100%\nnext line',
          docs: undefined,
        },
      ],
    },
    io,
    context,
  );
  expect(out()).toContain('100%25');
  expect(out()).toContain('%0Anext line');
  expect(out()).not.toContain('\n');
  expect(parseGithubAnnotation(out())).toEqual({
    command: 'error',
    props: { file: path.resolve(context.cwd, file), title: 'disable-lifecycle-scripts' },
    body: '[npm] .: set foo=bar, baz: 100%\nnext line',
  });
});

it('emits ordered annotations, with no synthetic file for a file-less check', async () => {
  const { io, out } = captureIO();
  await githubReporter.format(
    {
      inspection,
      findings: [
        {
          directory: '.',
          pm: 'npm',
          ruleId: 'first',
          severity: 'error',
          message: 'first message',
          file: '.npmrc',
        },
        {
          directory: '.',
          pm: 'pnpm',
          ruleId: 'second',
          severity: 'warn',
          message: 'second message',
          file: 'pnpm-workspace.yaml',
          docs: 'https://example.com/guide',
        },
        { directory: '.', ruleId: 'third', severity: 'info', message: 'third message' },
      ],
      summary: { error: 1, warn: 1, info: 1 },
    },
    io,
    context,
  );
  expect(out().split('\n').map(parseGithubAnnotation)).toEqual([
    {
      command: 'error',
      props: { file: path.resolve(context.cwd, '.npmrc'), title: 'first' },
      body: '[npm] .: first message',
    },
    {
      command: 'warning',
      props: { file: path.resolve(context.cwd, 'pnpm-workspace.yaml'), title: 'second' },
      body: '[pnpm] .: second message (https://example.com/guide)',
    },
    { command: 'notice', props: { title: 'third' }, body: '[package] .: third message' },
  ]);
});

it('prints scope and success for an empty report', async () => {
  const { io, out } = captureIO();
  await prettyReporter.format(
    { inspection, findings: [], summary: { error: 0, warn: 0, info: 0 } },
    io,
    context,
  );
  expect(out()).toContain('installation roots: none');
  expect(out()).toContain('No security best-practice issues');
});

it.each([
  [undefined, '1', true],
  ['', '1', true],
  ['1', '1', false],
  [undefined, '0', false],
] as const)('honors NO_COLOR=%s and FORCE_COLOR=%s', async (noColor, forceColor, colored) => {
  vi.stubEnv('NO_COLOR', noColor);
  vi.stubEnv('FORCE_COLOR', forceColor);
  const { io, out } = captureIO();
  await prettyReporter.format(result, io, context);
  expect(out().includes('\u001b[')).toBe(colored);
});

it('prints the finding, documentation and summary', async () => {
  vi.stubEnv('NO_COLOR', '1');
  const { io, out } = captureIO();
  await prettyReporter.format(result, io, context);
  expect(out()).toContain('[npm]');
  expect(out()).toContain('disable-lifecycle-scripts');
  expect(out()).toContain('set ignore-scripts');
  expect(out()).toContain('https://example.com/guide');
  expect(out()).toContain('Summary: 1 error, 0 warn, 0 info');
});

it.each([prettyReporter, jsonReporter, githubReporter])(
  'awaits the $name sink and propagates rejection',
  async (reporter) => {
    const failure = new Error('write failed');
    await expect(
      reporter.format(
        result,
        {
          async stdout() {
            throw failure;
          },
          stderr() {},
        },
        context,
      ),
    ).rejects.toBe(failure);
  },
);

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
