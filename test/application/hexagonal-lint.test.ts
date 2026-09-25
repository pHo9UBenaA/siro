import { lintCommand } from '../../src/application/commands/lint.ts';
import { lint } from '../../src/application/lint.ts';
import type { LintDependencies } from '../../src/application/ports/lint-dependencies.ts';
import { compileAdditionalWorkspaceGlob } from '../../src/application/workspace-dialects.ts';
import type { Reporter } from '../../src/domain/ports/reporter.ts';
import type { AbsPath } from '../../src/shared/paths.ts';
import { captureIO } from '../helpers/io.ts';

// A bounded in-memory host, with no production adapter or runtime composition.
const host = () => {
  const files: Record<string, string> = {
    '/virtual/package.json': '{"private":true,"workspaces":["packages/*"]}',
    '/virtual/packages/api/package.json': '{"name":"api"}',
  };
  const readText = vi.fn<LintDependencies['fileSystem']['readText']>(
    (path: AbsPath) => files[path],
  );
  const compile = vi.fn<LintDependencies['globs']['compile']>((pattern) => ({
    matches: (directory) => pattern === 'packages/*' && directory === 'packages/api',
    canDescend: (directory) => pattern === 'packages/*' && directory === 'packages',
  }));
  const dependencies: LintDependencies = {
    rules: [
      {
        id: 'files-field',
        title: 'Publication boundary',
        description: 'Test publication rule',
        severity: 'error',
        bindings: {
          npm: {
            check: (ctx) =>
              ctx.packageJson?.private === true
                ? { state: 'ok' }
                : { state: 'violation', message: 'Review publication files.' },
          },
        },
      },
    ],
    fileSystem: {
      readText,
      exists: (path) => files[path] !== undefined,
      readDirectories: (path) =>
        path === '/virtual' ? ['packages'] : path === '/virtual/packages' ? ['api'] : [],
    },
    paths: {
      isAbsolute: (value): value is AbsPath =>
        typeof value === 'string' && value.startsWith('/virtual'),
      resolve: (root, relative) => (relative === '.' ? root : `${root}/${relative}`) as AbsPath,
      normalizePattern: (pattern) => pattern,
    },
    codecFor: () => ({ parse: JSON.parse }),
    globs: { expand: (pattern) => [pattern], compile },
    caseInsensitiveGlobs: false,
    createRepoContext: (root, fs, projectType) => ({
      root,
      projectType,
      packageJson: JSON.parse(fs.readText(`${root}/package.json` as AbsPath) ?? '{}'),
      exists: (relative) => fs.exists(`${root}/${relative}` as AbsPath),
      readText: (relative) => fs.readText(`${root}/${relative}` as AbsPath),
    }),
  };
  return { dependencies, readText, compile };
};
const request = { cwd: '/virtual' as AbsPath, pm: 'npm' as const, workspaces: true };

it('evaluates a workspace entirely through supplied ports and preserves member paths', () => {
  const { dependencies } = host();
  expect(lint(request, dependencies)).toEqual({
    findings: [
      expect.objectContaining({
        ruleId: 'files-field',
        file: 'packages/api/package.json',
        message: 'packages/api: Review publication files.',
        severity: 'error',
      }),
    ],
    summary: { error: 1, warn: 0, info: 0 },
  });
});

it.each([false, true])(
  'passes explicit glob case policy %s independently of the host OS',
  (caseInsensitiveGlobs) => {
    const { dependencies, compile } = host();
    lint(request, { ...dependencies, caseInsensitiveGlobs });
    expect(compile).toHaveBeenCalledWith(
      'packages/*',
      expect.objectContaining({ caseInsensitive: caseInsensitiveGlobs }),
    );
  },
);

it('prepares Bun matchers only with Bun semantics', () => {
  const { dependencies, compile } = host();
  compile.mockImplementation((pattern, options) => {
    if (options.kind !== 'directory' || options.extendedPatterns !== false)
      throw new Error('Unexpected standard glob compilation');
    return {
      matches: (directory) => pattern === 'packages/*' && directory === 'packages/api',
      canDescend: (directory) => pattern === 'packages/*' && directory === 'packages',
    };
  });
  expect(() => lint({ ...request, pm: 'bun' }, dependencies)).not.toThrow();
  expect(compile).toHaveBeenCalledWith(
    'packages/*',
    expect.objectContaining({ extendedPatterns: false }),
  );
});

it('uses the request filesystem consistently for root and member reads', () => {
  const { dependencies } = host();
  const original = dependencies.fileSystem;
  const fs = {
    ...original,
    readText: vi.fn<LintDependencies['fileSystem']['readText']>(original.readText),
  };
  dependencies.fileSystem.readText = () => {
    throw new Error('Default filesystem used');
  };
  expect(lint({ ...request, fs }, dependencies).summary.error).toBe(1);
  expect(fs.readText).toHaveBeenCalledWith('/virtual/packages/api/package.json');
});

it('reports through an injected registry and propagates asynchronous output failures', async () => {
  const { dependencies } = host();
  const { io } = captureIO();
  const format = vi.fn<Reporter['format']>();
  const registry = {
    defaultName: 'test',
    createRegistry: () => new Map([['test', { name: 'test', format }]]),
  };
  expect(await lintCommand(request, io, dependencies, registry)).toBe(1);
  expect(format).toHaveBeenCalledWith(
    expect.objectContaining({ summary: { error: 1, warn: 0, info: 0 } }),
    io,
  );
  const failure = new Error('output failed');
  format.mockRejectedValueOnce(failure);
  await expect(lintCommand(request, io, dependencies, registry)).rejects.toBe(failure);
});

it('does not fall back to the default filesystem for an explicitly invalid null adapter', () => {
  const { dependencies, readText } = host();
  expect(() => lint({ ...request, fs: null as never }, dependencies)).toThrow(TypeError);
  expect(readText).not.toHaveBeenCalled();
});

it('passes literal PM patterns to the glob port without engine-specific escaping', () => {
  const { dependencies, compile } = host();
  compileAdditionalWorkspaceGlob('packages/[api]/*', 'deno', false, false, dependencies.globs);
  expect(compile).toHaveBeenCalledWith('packages/[api]/*', {
    kind: 'directory',
    syntax: 'wildcards',
    includeDotDirectories: false,
    caseInsensitive: true,
  });
  expect(compile).toHaveBeenCalledWith('packages/[api]/*/package.json', {
    kind: 'directory',
    syntax: 'wildcards',
    caseInsensitive: true,
  });
});
