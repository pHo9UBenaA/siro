import { asAbsPath, ConfigError, lint, lintCommand, type Rule } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { captureIO } from '../helpers/io.ts';

const cwd = asAbsPath('/repo');
const options = { cwd, installationRoots: [] };
const raw = '{"private":true}';

it('enforces exact file byte boundaries and counts UTF-8 rather than code units', () => {
  const fs = createMemFileSystem({ 'package.json': raw });
  for (const maxFileBytes of [raw.length, raw.length + 1]) {
    expect(lint({ ...options, fs, limits: { maxFileBytes } }).inspection.manifests).toHaveLength(1);
  }
  expect(() => lint({ ...options, fs, limits: { maxFileBytes: raw.length - 1 } })).toThrow(
    /maxFileBytes/,
  );
  const unicode = '{"name":"é"}';
  expect(() =>
    lint({
      ...options,
      fs: createMemFileSystem({ 'package.json': unicode }),
      limits: { maxFileBytes: unicode.length },
    }),
  ).toThrow(/maxFileBytes/);
});

it('shares a scan read budget, memoizes reads, and resets between scans', () => {
  const fs = createMemFileSystem({ 'package.json': raw, 'child/package.json': raw });
  const request = { ...options, fs, limits: { maxTotalBytes: raw.length * 2 } };
  expect(lint(request).inspection.manifests).toHaveLength(2);
  expect(lint(request).inspection.manifests).toHaveLength(2);
  expect(() => lint({ ...request, limits: { maxTotalBytes: raw.length * 2 - 1 } })).toThrow(
    /maxTotalBytes/,
  );
});

it('rejects tree count/depth overflow rather than returning partial inspection', () => {
  const fs = createMemFileSystem({ 'a/b/package.json': raw });
  expect(
    lint({ ...options, fs, limits: { maxDirectories: 3, maxDirectoryDepth: 2 } }).inspection
      .manifests,
  ).toHaveLength(1);
  expect(() => lint({ ...options, fs, limits: { maxDirectories: 2 } })).toThrow(/maxDirectories/);
  expect(() => lint({ ...options, fs, limits: { maxDirectoryDepth: 1 } })).toThrow(
    /maxDirectoryDepth/,
  );
});

it('bounds nesting even in unconsumed manifest fields', () => {
  const fs = createMemFileSystem({ 'package.json': '{"private":true,"unknown":{"nested":{}}}' });
  expect(() => lint({ ...options, fs, limits: { maxConfigDepth: 2 } })).toThrow(/maxConfigDepth/);
  expect(lint({ ...options, fs, limits: { maxConfigDepth: 3 } }).inspection.manifests).toHaveLength(
    1,
  );
});

it('bounds findings without allowing severity filtering to hide overflow', async () => {
  const fs = createMemFileSystem({ 'package.json': '{"name":"public"}' });
  const request = { ...options, fs, limits: { maxFindings: 1 } };
  expect(() => lint(request)).toThrow(/maxFindings/);
  const { io, out } = captureIO();
  await expect(
    lintCommand({ ...request, severity: 'error', reporter: 'json' }, io),
  ).rejects.toThrow(/maxFindings/);
  expect(out()).toBe('');
});

const groupedRule = (count: number): Rule => ({
  id: 'many-findings',
  title: 'Many findings',
  description: 'Exercises grouped results',
  severity: 'info',
  bindings: {
    npm: {
      check: () => ({
        state: 'violations',
        violations: [
          { state: 'violation', message: 'finding 0' },
          ...Array.from({ length: count - 1 }, (_, index) => ({
            state: 'violation' as const,
            message: `finding ${index + 1}`,
          })),
        ],
      }),
    },
  },
});

it('classifies a large grouped result as a finding limit failure, not an engine argument overflow', async () => {
  const request = {
    ...options,
    pm: 'npm' as const,
    fs: createMemFileSystem({}),
    config: { customRules: [groupedRule(150_000)] },
  };
  expect(() => lint(request)).toThrow(ConfigError);
  const { io, out } = captureIO();
  await expect(
    lintCommand({ ...request, reporter: 'json', severity: 'error' }, io),
  ).rejects.toThrow(/maxFindings/);
  expect(out()).toBe('');
  const result = lint({ ...request, limits: { maxFindings: 150_000 } });
  expect(result.findings).toHaveLength(150_000);
  expect(result.findings.at(-1)?.message).toBe('finding 149999');
});

it('accepts the exact grouped finding limit and rejects the next finding', () => {
  const request = {
    ...options,
    pm: 'npm' as const,
    fs: createMemFileSystem({}),
    limits: { maxFindings: 2 },
  };
  expect(lint({ ...request, config: { customRules: [groupedRule(2)] } }).findings).toHaveLength(2);
  expect(() => lint({ ...request, config: { customRules: [groupedRule(3)] } })).toThrow(
    /maxFindings/,
  );
});

it.each([NaN, Infinity, 0, -1, 1.5])('rejects invalid limits %s', (maxFileBytes) => {
  expect(() => lint({ ...options, fs: createMemFileSystem({}), limits: { maxFileBytes } })).toThrow(
    /positive safe integer/,
  );
});

it('bounds JSON output before writing and preserves native JSON decoding', async () => {
  const fs = createMemFileSystem({ 'package.json': raw });
  const { io, out } = captureIO();
  await expect(
    lintCommand({ ...options, fs, reporter: 'json', limits: { maxOutputBytes: 1 } }, io),
  ).rejects.toThrow(/maxOutputBytes/);
  expect(out()).toBe('');
  await lintCommand({ ...options, fs, reporter: 'json' }, io);
  expect(JSON.parse(out()).inspection.manifests[0].path).toBe('package.json');
});
