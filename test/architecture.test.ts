import { readFileSync, readdirSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const LAYERS = [
  'shared',
  'domain',
  'application',
  'application-ports',
  'adapters',
  'composition',
  'cli',
  'public',
] as const;
type Layer = (typeof LAYERS)[number];
interface SourceFile {
  readonly path: string;
  readonly content: string;
}

const allowedTargets: Readonly<Record<Layer, ReadonlySet<Layer>>> = {
  shared: new Set(),
  domain: new Set(['shared']),
  'application-ports': new Set(['shared', 'domain']),
  application: new Set(['shared', 'domain', 'application-ports']),
  adapters: new Set(['shared', 'domain', 'application-ports']),
  composition: new Set(['shared', 'domain', 'application-ports', 'application', 'adapters']),
  cli: new Set(['shared', 'domain', 'application-ports', 'application', 'adapters', 'composition']),
  public: new Set([
    'shared',
    'domain',
    'application-ports',
    'application',
    'adapters',
    'composition',
  ]),
};
const core = new Set<Layer>(['shared', 'domain', 'application-ports', 'application']);

const sourceRoot = path.resolve(import.meta.dirname, '../src');
const projectRoot = path.resolve(sourceRoot, '..');
const canonicalFileName = (file: string): string => {
  const absolute = path.resolve(file).split(path.sep).join('/');
  return ts.sys.useCaseSensitiveFileNames ? absolute : absolute.toLowerCase();
};
const config = ts.readConfigFile(path.join(projectRoot, 'tsconfig.json'), ts.sys.readFile);
const compilerOptions = ts.convertCompilerOptionsFromJson(
  config.config.compilerOptions,
  projectRoot,
).options;
const layerOf = (file: string): Layer | undefined => {
  if (/^application\/(?:.*\/)?ports\//u.test(file)) return 'application-ports';
  if (/^index\.(?:ts|js)$/u.test(file)) return 'public';
  if (/^version\.(?:ts|js)$/u.test(file)) return 'shared';
  if (file === 'cli.ts' || file === 'cli.js' || file.startsWith('cli/')) return 'cli';
  const [first] = file.split('/');
  return LAYERS.find((layer) => layer === first);
};

const findViolations = (files: readonly SourceFile[]): string[] => {
  const violations: string[] = [];
  const contents = new Map(
    files.map((file) => [canonicalFileName(path.join(sourceRoot, file.path)), file.content]),
  );
  const host: ts.ModuleResolutionHost = {
    fileExists: (file) => contents.has(canonicalFileName(file)),
    readFile: (file) => contents.get(canonicalFileName(file)),
  };
  for (const file of files) {
    const sourceLayer = layerOf(file.path);
    const fail = (reason: string) => violations.push(`${file.path}: ${reason}`);
    if (!sourceLayer) {
      fail('unclassified source file');
      continue;
    }
    const inCore = core.has(sourceLayer);
    const inspectImport = (specifier: string) => {
      const packageMetadata = path.resolve(sourceRoot, path.dirname(file.path), specifier);
      if (packageMetadata === path.join(projectRoot, 'package.json')) return;
      if (isBuiltin(specifier)) {
        if (inCore) fail(`forbidden host dependency ${specifier}`);
        return;
      }
      // Use the same resolution as the compiler: .js specifiers may resolve to
      // .ts files; aliases and index modules must not hide a reverse edge.
      const resolved = ts.resolveModuleName(
        specifier,
        path.join(sourceRoot, file.path),
        compilerOptions,
        host,
      ).resolvedModule;
      if (!resolved) {
        if (specifier.startsWith('.') || path.isAbsolute(specifier))
          fail(`unresolved source dependency ${specifier}`);
        // Package availability belongs to typecheck, build and installed-package tests.
        return;
      }
      const target = path.relative(sourceRoot, resolved.resolvedFileName).split(path.sep).join('/');
      const targetLayer = layerOf(target);
      if (!targetLayer) fail(`unclassified dependency ${specifier}`);
      else if (targetLayer !== sourceLayer && !allowedTargets[sourceLayer].has(targetLayer)) {
        fail(`forbidden ${targetLayer} dependency ${specifier}`);
      }
    };
    const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        inspectImport(node.moduleSpecifier.text);
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        inspectImport(node.argument.literal.text);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        const [argument] = node.arguments;
        if (
          argument &&
          (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
        )
          inspectImport(argument.text);
        else if (inCore) fail('dynamic module selection in core');
      }
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      ) {
        const reference = node.moduleReference.expression;
        if (reference && ts.isStringLiteral(reference)) inspectImport(reference.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return violations;
};

const readSources = (root: string, relative = ''): SourceFile[] =>
  readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return readSources(root, entryPath);
    if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?)$/u.test(entry.name)) return [];
    return [{ path: entryPath, content: readFileSync(path.join(root, entryPath), 'utf8') }];
  });

it('keeps source imports directed inward, including type references', () => {
  expect(findViolations(readSources(sourceRoot))).toEqual([]);
});

it.each([
  ['domain/rule.ts', "import fs from 'node:fs';"],
  ['shared/path.ts', "import path from 'path';"],
  ['application/load.ts', 'const value = import(name);'],
  ['unclassified.ts', 'export const value = 1;'],
])('rejects forbidden dependencies in %s: %s', (file, content) => {
  expect(findViolations([{ path: file, content }]).length).toBeGreaterThan(0);
});

it('allows ordinary computation choices, ports, and outer composition', () => {
  expect(
    findViolations([
      { path: 'domain/value.ts', content: "import { lt } from 'semver';" },
      { path: 'domain/format.ts', content: "import parser from 'some-computation-library';" },
      { path: 'domain/current.ts', content: 'const now = Date.now();' },
      { path: 'domain/epoch-date.ts', content: 'const value = new Date(now - age * 1000);' },
      {
        path: 'domain/utc-date.ts',
        content: 'const value = new Date(`${date}T00:00:00Z`);',
      },
      { path: 'domain/ports/repo-context.ts', content: 'export interface RepoContext {}' },
      {
        path: 'application/ports/repository-paths.ts',
        content: 'export interface RepositoryPaths {}',
      },
      {
        path: 'application/lint.ts',
        content: "import type { RepoContext } from '../domain/ports/repo-context.ts';",
      },
      {
        path: 'adapters/fs.ts',
        content:
          "import type { RepositoryPaths } from '../application/ports/repository-paths.ts'; import fs from 'node:fs';",
      },
      {
        path: 'composition/lint.ts',
        content:
          "import { lint } from '../application/lint.ts'; import { fs } from '../adapters/fs.ts';",
      },
    ]),
  ).toEqual([]);
});

it('permits same-layer type relationships and ports grouped with their feature', () => {
  expect(
    findViolations([
      {
        path: 'domain/a.ts',
        content: "import type { B } from './b.ts'; export interface A { b?: B }",
      },
      {
        path: 'domain/b.ts',
        content: "import type { A } from './a.ts'; export interface B { a?: A }",
      },
      { path: 'application/workspace/ports/glob.ts', content: 'export interface Glob {}' },
      {
        path: 'adapters/glob.ts',
        content: "import type { Glob } from '../application/workspace/ports/glob.ts';",
      },
    ]),
  ).toEqual([]);
});

it('resolves JavaScript extensions to TypeScript before checking direction', () => {
  expect(
    findViolations([
      { path: 'application/use.ts', content: "import type { Value } from '../adapters/value.js';" },
      { path: 'adapters/value.ts', content: 'export interface Value {}' },
    ]),
  ).toEqual(['application/use.ts: forbidden adapters dependency ../adapters/value.js']);
});

it('rejects adapters coupled to application implementations and ports coupled to use cases', () => {
  expect(
    findViolations([
      {
        path: 'adapters/fs.ts',
        content: "import type { LintOptions } from '../application/lint.ts';",
      },
      {
        path: 'application/ports/fs.ts',
        content: "export type { LintOptions } from '../lint.ts';",
      },
      {
        path: 'application/workspace/ports/glob.ts',
        content: "import type { LintOptions } from '../../lint.ts';",
      },
      { path: 'application/lint.ts', content: 'export interface LintOptions {}' },
    ]),
  ).toEqual([
    'adapters/fs.ts: forbidden application dependency ../application/lint.ts',
    'application/ports/fs.ts: forbidden application dependency ../lint.ts',
    'application/workspace/ports/glob.ts: forbidden application dependency ../../lint.ts',
  ]);
});

it('rejects unresolved local imports instead of silently omitting their edges', () => {
  expect(
    findViolations([{ path: 'domain/a.ts', content: "export * from './missing.ts';" }]),
  ).toEqual(['domain/a.ts: unresolved source dependency ./missing.ts']);
});

it('checks direction through static dynamic imports and CommonJS references', () => {
  expect(
    findViolations([
      { path: 'domain/a.ts', content: 'const b = import(`../adapters/b.ts`);' },
      { path: 'adapters/b.ts', content: "import c = require('../composition/c.ts');" },
      { path: 'composition/c.ts', content: 'export const value = 1;' },
    ]),
  ).toEqual([
    'domain/a.ts: forbidden adapters dependency ../adapters/b.ts',
    'adapters/b.ts: forbidden composition dependency ../composition/c.ts',
  ]);
});

it.each([
  [
    'application/use.ts',
    'adapters/fs.ts',
    "import { value } from '../adapters/fs.ts';",
    'adapters',
  ],
  [
    'application/use.ts',
    'composition/root.ts',
    "import type { Value } from '../composition/root.ts';",
    'composition',
  ],
  ['application/use.ts', 'index.ts', "export { value } from '../index.ts';", 'public'],
  [
    'domain/rule.ts',
    'application/value.ts',
    "export { value } from '../application/value.ts';",
    'application',
  ],
  ['shared/value.ts', 'domain/value.ts', "const value = import('../domain/value.ts');", 'domain'],
  [
    'adapters/fs.ts',
    'composition/root.ts',
    "export { value } from '../composition/root.ts';",
    'composition',
  ],
  [
    'application/use.ts',
    'unclassified.ts',
    "import { value } from '../unclassified.ts';",
    undefined,
  ],
] as const)('checks resolved layer boundaries from %s to %s', (source, target, content, layer) => {
  const errors = findViolations([
    { path: source, content },
    { path: target, content: 'export const value = 1; export type Value = number;' },
  ]);
  expect(errors).toContain(
    layer
      ? source + ': forbidden ' + layer + ' dependency ' + content.match(/['"]([^'"]+)['"]/)?.[1]
      : source + ': unclassified dependency ../unclassified.ts',
  );
  expect(errors.some((error) => error.includes('unresolved source dependency'))).toBe(false);
});
