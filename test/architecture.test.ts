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
// Audited computation libraries; runtime and format libraries belong outside the core.
const coreLibraries = new Set(['semver', 'valibot']);
const runtimeGlobals = new Set([
  'process',
  'global',
  'globalThis',
  'Buffer',
  'console',
  'fetch',
  'require',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'Date',
  'performance',
  'crypto',
]);

const explicitDateOffset = /(?:[zZ]|[+-]\d{2}:?\d{2})$/u;
const numericDateOperators = new Set([
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);

const hasExplicitDateOffset = (node: ts.Expression): boolean => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return explicitDateOffset.test(node.text);
  }
  if (ts.isTemplateExpression(node)) {
    return explicitDateOffset.test(node.templateSpans.at(-1)?.literal.text ?? node.head.text);
  }
  return false;
};

const isNumericDateExpression = (node: ts.Expression): boolean => {
  if (ts.isNumericLiteral(node)) return true;
  if (ts.isParenthesizedExpression(node)) return isNumericDateExpression(node.expression);
  if (ts.isPrefixUnaryExpression(node)) {
    return node.operator === ts.SyntaxKind.PlusToken || node.operator === ts.SyntaxKind.MinusToken;
  }
  if (!ts.isBinaryExpression(node)) return false;
  return numericDateOperators.has(node.operatorToken.kind);
};

const isDeterministicDateConstructor = (node: ts.Identifier): boolean => {
  if (!ts.isNewExpression(node.parent) || node.parent.expression !== node) return false;
  const [argument] = node.parent.arguments ?? [];
  return (
    node.parent.arguments?.length === 1 &&
    argument !== undefined &&
    (isNumericDateExpression(argument) || hasExplicitDateOffset(argument))
  );
};

const sourceRoot = path.resolve(import.meta.dirname, '../src');
const projectRoot = path.resolve(sourceRoot, '..');
const config = ts.readConfigFile(path.join(projectRoot, 'tsconfig.json'), ts.sys.readFile);
const compilerOptions = ts.convertCompilerOptionsFromJson(
  config.config.compilerOptions,
  projectRoot,
).options;
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const runtimeLibraries = new Set(Object.keys(packageJson.dependencies));

const layerOf = (file: string): Layer | undefined => {
  if (file.startsWith('application/ports/')) return 'application-ports';
  if (/^index\.(?:ts|js)$/u.test(file)) return 'public';
  if (/^version\.(?:ts|js)$/u.test(file)) return 'shared';
  if (file === 'cli.ts' || file === 'cli.js' || file.startsWith('cli/')) return 'cli';
  const [first] = file.split('/');
  return LAYERS.find((layer) => layer === first);
};

const findViolations = (files: readonly SourceFile[]): string[] => {
  const violations: string[] = [];
  const graph = new Map(files.map((file) => [file.path, new Set<string>()]));
  const contents = new Map(files.map((file) => [path.join(sourceRoot, file.path), file.content]));
  const host: ts.ModuleResolutionHost = {
    fileExists: (file) => contents.has(file),
    readFile: (file) => contents.get(file),
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
      if (file.path === 'version.ts' && packageMetadata === path.join(projectRoot, 'package.json'))
        return;
      // Use the same resolution as the compiler: .js specifiers may resolve to
      // .ts files; aliases and index modules must not hide a reverse edge/cycle.
      const resolved = ts.resolveModuleName(
        specifier,
        path.join(sourceRoot, file.path),
        compilerOptions,
        host,
      ).resolvedModule;
      if (!resolved) {
        const library = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0];
        if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
          fail(`unresolved source dependency ${specifier}`);
        } else if (
          inCore
            ? !coreLibraries.has(library ?? '')
            : !isBuiltin(specifier) && !runtimeLibraries.has(library ?? '')
        ) {
          fail(`forbidden external dependency ${specifier}`);
        }
        return;
      }
      const target = path.relative(sourceRoot, resolved.resolvedFileName).split(path.sep).join('/');
      graph.get(file.path)?.add(target);
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
      if (inCore && ts.isIdentifier(node) && runtimeGlobals.has(node.text)) {
        const deterministicDate =
          node.text === 'Date' &&
          ((ts.isPropertyAccessExpression(node.parent) && node.parent.name.text === 'UTC') ||
            isDeterministicDateConstructor(node));
        if (!deterministicDate) fail(`runtime global ${node.text} in core`);
      }
      if (inCore && ts.isMetaProperty(node)) fail('runtime metadata in core');
      if (
        inCore &&
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Math' &&
        node.name.text === 'random'
      ) {
        fail('ambient randomness in core');
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  // All edges count, including type-only references and re-exports. A completed
  // node may be shared by multiple branches; only an active ancestor is a cycle.
  const completed = new Set<string>();
  const active = new Set<string>();
  const trail: string[] = [];
  const visitDependency = (file: string): void => {
    if (active.has(file)) {
      violations.push(
        `dependency cycle: ${[...trail.slice(trail.indexOf(file)), file].join(' -> ')}`,
      );
      return;
    }
    if (completed.has(file)) return;
    active.add(file);
    trail.push(file);
    for (const target of graph.get(file) ?? []) visitDependency(target);
    trail.pop();
    active.delete(file);
    completed.add(file);
  };
  for (const file of graph.keys()) visitDependency(file);
  return violations;
};

const readSources = (root: string, relative = ''): SourceFile[] =>
  readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return readSources(root, entryPath);
    if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?)$/u.test(entry.name)) return [];
    return [{ path: entryPath, content: readFileSync(path.join(root, entryPath), 'utf8') }];
  });

it('keeps the source graph acyclic, including types, with only inward dependencies', () => {
  expect(findViolations(readSources(sourceRoot))).toEqual([]);
});

it.each([
  ['domain/rule.ts', "import fs from 'node:fs';"],
  ['shared/path.ts', "import path from 'path';"],
  ['application/glob.ts', 'const insensitive = process.platform === "darwin";'],
  ['shared/value.ts', 'const value = globalThis.process;'],
  ['application/load.ts', 'const value = import(name);'],
  ['domain/rule.ts', 'const value = Math.random();'],
  ['domain/rule.ts', 'const value = Date.now();'],
  ['domain/rule.ts', 'const value = Date.parse(input);'],
  ['domain/rule.ts', 'const value = new Date();'],
  ['domain/rule.ts', "const value = new Date('2030-01-01T00:00:00');"],
  ['domain/rule.ts', 'const value = new Date(input);'],
  ['application/load.ts', "import yaml from 'yaml';"],
  ['unclassified.ts', 'export const value = 1;'],
])('rejects forbidden dependencies in %s: %s', (file, content) => {
  expect(findViolations([{ path: file, content }]).length).toBeGreaterThan(0);
});

it('allows ports, pure computation libraries, and outer composition', () => {
  expect(
    findViolations([
      { path: 'domain/value.ts', content: "import { lt } from 'semver';" },
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

it.each([
  ["import { value } from './b.ts';", "export { value } from './a.ts';"],
  ["import type { Value } from './b.ts';", "export type { Value } from './a.ts';"],
  ["type Value = import('./b.ts').Value;", "type Value = import('./a.ts').Value;"],
  ["const value = import('./b.ts');", "export * from './a.ts';"],
])('rejects same-layer cycles through imports, exports and type references', (a, b) => {
  expect(
    findViolations([
      { path: 'domain/a.ts', content: a },
      { path: 'domain/b.ts', content: b },
    ]),
  ).toContain('dependency cycle: domain/a.ts -> domain/b.ts -> domain/a.ts');
});

it('rejects self imports and cycles hidden behind intermediate modules', () => {
  expect(
    findViolations([
      { path: 'domain/a.ts', content: "import type { Value } from './b.ts';" },
      { path: 'domain/b.ts', content: "export type { Value } from './c.ts';" },
      { path: 'domain/c.ts', content: "import type { Value } from './a.ts';" },
      { path: 'shared/self.ts', content: "export * from './self.ts';" },
    ]),
  ).toEqual([
    'dependency cycle: domain/a.ts -> domain/b.ts -> domain/c.ts -> domain/a.ts',
    'dependency cycle: shared/self.ts -> shared/self.ts',
  ]);
});

it('allows diamond dependencies on a shared contract without treating them as cycles', () => {
  expect(
    findViolations([
      { path: 'domain/a.ts', content: "import './b.ts'; import './c.ts';" },
      { path: 'domain/b.ts', content: "export type { Value } from './d.ts';" },
      { path: 'domain/c.ts', content: "import type { Value } from './d.ts';" },
      { path: 'domain/d.ts', content: 'export type Value = string;' },
    ]),
  ).toEqual([]);
});

it('resolves JavaScript extensions to TypeScript sources before checking cycles', () => {
  expect(
    findViolations([
      { path: 'domain/a.ts', content: "import type { Value } from './b.js';" },
      { path: 'domain/b.ts', content: "export type { Value } from './a.js';" },
    ]),
  ).toContain('dependency cycle: domain/a.ts -> domain/b.ts -> domain/a.ts');
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
      { path: 'application/lint.ts', content: 'export interface LintOptions {}' },
    ]),
  ).toEqual([
    'adapters/fs.ts: forbidden application dependency ../application/lint.ts',
    'application/ports/fs.ts: forbidden application dependency ../lint.ts',
  ]);
});

it('rejects unresolved local imports instead of silently omitting their edges', () => {
  expect(
    findViolations([{ path: 'domain/a.ts', content: "export * from './missing.ts';" }]),
  ).toEqual(['domain/a.ts: unresolved source dependency ./missing.ts']);
});

it('follows static dynamic imports and CommonJS references in outer adapters', () => {
  expect(
    findViolations([
      { path: 'adapters/a.ts', content: 'const b = import(`./b.ts`);' },
      { path: 'adapters/b.ts', content: "import c = require('./c.ts');" },
      { path: 'adapters/c.ts', content: "const a = require('./a.ts');" },
    ]),
  ).toContain('dependency cycle: adapters/a.ts -> adapters/b.ts -> adapters/c.ts -> adapters/a.ts');
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
