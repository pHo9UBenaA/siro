import { lintCommand } from '../../src/core/lint-command.ts';
import { lint } from '../../src/core/lint.ts';
import { createBuiltinRules } from '../../src/core/rules/builtin-rules.ts';
import { type LintDependencies } from '../../src/core/contracts/lint-dependencies.ts';
import { type Reporter } from '../../src/core/contracts/reporter.ts';
import { asRelPath, type AbsPath } from '../../src/core/contracts/paths.ts';
import { captureIO } from '../helpers/io.ts';

const request = { cwd: '/virtual' as AbsPath, installationRoots: [] };
// No production adapter or runtime composition: all IO goes through these ports.
const host = () => {
  const files: Record<string, string> = {
    '/virtual/package.json': '{"private":true}',
    '/virtual/packages/api/package.json': '{"name":"api"}',
  };
  const readText = vi.fn<LintDependencies['fileSystem']['readText']>((path) => files[path]);
  const dependencies: LintDependencies = {
    rules: createBuiltinRules({ now: () => 0, parse: () => NaN }),
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
      child: (parent, name) =>
        asRelPath(parent === '.' ? String(name) : `${parent}/${String(name)}`),
    },
    codecFor: () => ({ parse: JSON.parse }),
    compileExclusions: (patterns) => (directory) => patterns.includes(directory),
    createRepoContext: (root, fs, projectType) => {
      const raw = fs.readText(`${root}/package.json` as AbsPath);
      return {
        root,
        projectType,
        packageJson: raw === undefined ? undefined : JSON.parse(raw),
        exists: (relative) => fs.exists(`${root}/${relative}` as AbsPath),
        readText: (relative) => fs.readText(`${root}/${relative}` as AbsPath),
      };
    },
  };
  return { dependencies, readText };
};

it('discovers and evaluates through supplied ports, with generic paths and explicit inspection', () => {
  const { dependencies } = host();
  const result = lint(request, dependencies);
  expect(result.findings).toEqual([
    expect.objectContaining({
      ruleId: 'files-field',
      directory: 'packages/api',
      file: 'packages/api/package.json',
    }),
    expect.objectContaining({
      ruleId: 'publish-access',
      directory: 'packages/api',
      file: 'packages/api/package.json',
    }),
  ]);
  expect(result.inspection.installationRoots).toEqual([]);
  expect(result.findings.every((finding) => finding.pm === undefined)).toBe(true);
});

it('uses the explicitly supplied filesystem throughout discovery', () => {
  const { dependencies } = host();
  const fs = {
    ...dependencies.fileSystem,
    readText: vi.fn<LintDependencies['fileSystem']['readText']>(dependencies.fileSystem.readText),
  };
  dependencies.fileSystem.readText = () => {
    throw new Error('Default filesystem used');
  };
  lint({ ...request, fs }, dependencies);
  expect(fs.readText).toHaveBeenCalledWith('/virtual/packages/api/package.json');
});

it('reports through an injected registry and awaits output failures', async () => {
  const { dependencies } = host();
  const { io } = captureIO();
  const format = vi.fn<Reporter['format']>();
  const registry = {
    defaultName: 'test',
    createRegistry: () => new Map([['test', { name: 'test', format }]]),
  };
  expect(await lintCommand(request, io, dependencies, registry)).toBe(0);
  expect(format).toHaveBeenCalled();
  const failure = new Error('output failed');
  format.mockRejectedValueOnce(failure);
  await expect(lintCommand(request, io, dependencies, registry)).rejects.toBe(failure);
});

it('does not fall back for an explicitly invalid null filesystem', () => {
  const { dependencies, readText } = host();
  expect(() => lint({ ...request, fs: null as never }, dependencies)).toThrow(TypeError);
  expect(readText).not.toHaveBeenCalled();
});
