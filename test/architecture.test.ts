import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';

const LAYERS = [
  'shared',
  'domain',
  'application',
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
  application: new Set(['shared', 'domain']),
  adapters: new Set(['shared', 'domain', 'application']),
  composition: new Set(['shared', 'domain', 'application', 'adapters']),
  cli: new Set(['shared', 'domain', 'application', 'adapters', 'composition']),
  public: new Set(['shared', 'domain', 'application', 'adapters', 'composition']),
};
const core = new Set<Layer>(['shared', 'domain', 'application']);
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

const layerOf = (file: string): Layer | undefined => {
  if (/^index\.(?:ts|js)$/u.test(file)) return 'public';
  if (/^version\.(?:ts|js)$/u.test(file)) return 'shared';
  if (file === 'cli.ts' || file === 'cli.js' || file.startsWith('cli/')) return 'cli';
  const [first] = file.split('/');
  return LAYERS.find((layer) => layer === first);
};

const findViolations = (files: readonly SourceFile[]): string[] => {
  const violations: string[] = [];
  for (const file of files) {
    const sourceLayer = layerOf(file.path);
    const fail = (reason: string) => violations.push(`${file.path}: ${reason}`);
    if (!sourceLayer) {
      fail('unclassified source file');
      continue;
    }
    const inCore = core.has(sourceLayer);
    const inspectImport = (specifier: string) => {
      if (!specifier.startsWith('.')) {
        if (inCore && (isBuiltin(specifier) || !coreLibraries.has(specifier.split('/')[0] ?? ''))) {
          fail(`forbidden external dependency ${specifier}`);
        }
        return;
      }
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(file.path), specifier),
      );
      if (file.path === 'version.ts' && target === '../package.json') return;
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
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const [argument] = node.arguments;
        if (argument && ts.isStringLiteral(argument)) inspectImport(argument.text);
        else if (inCore) fail('dynamic module selection in core');
      }
      if (inCore && ts.isIdentifier(node) && runtimeGlobals.has(node.text)) {
        const deterministicDate =
          node.text === 'Date' &&
          ((ts.isPropertyAccessExpression(node.parent) && node.parent.name.text === 'UTC') ||
            (ts.isNewExpression(node.parent) && (node.parent.arguments?.length ?? 0) > 0));
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
  return violations;
};

const readSources = (root: string, relative = ''): SourceFile[] =>
  readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) return readSources(root, entryPath);
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    return [{ path: entryPath, content: readFileSync(path.join(root, entryPath), 'utf8') }];
  });

it('keeps every core dependency inside the hexagon and isolates runtime composition', () => {
  expect(findViolations(readSources(path.resolve(import.meta.dirname, '../src')))).toEqual([]);
});

it.each([
  ['domain/rule.ts', "import fs from 'node:fs';"],
  ['shared/path.ts', "import path from 'path';"],
  ['application/lint.ts', "import { fs } from '../adapters/fs.ts';"],
  ['application/lint.ts', "import type { Factory } from '../composition/lint.ts';"],
  ['application/lint.ts', "export { lint } from '../index.ts';"],
  ['application/lint.ts', "type Loader = typeof import('../adapters/loader.ts');"],
  ['domain/rule.ts', "export { value } from '../application/value.ts';"],
  ['shared/value.ts', "const value = import('../domain/value.ts');"],
  ['adapters/fs.ts', "export { lint } from '../composition/lint.ts';"],
  ['application/glob.ts', 'const insensitive = process.platform === "darwin";'],
  ['shared/value.ts', 'const value = globalThis.process;'],
  ['application/load.ts', 'const value = import(name);'],
  ['domain/rule.ts', 'const value = Math.random();'],
  ['domain/rule.ts', 'const value = Date.now();'],
  ['domain/rule.ts', 'const value = Date.parse(input);'],
  ['domain/rule.ts', 'const value = new Date();'],
  ['application/load.ts', "import yaml from 'yaml';"],
  ['application/load.ts', "import value from '../unclassified.ts';"],
  ['unclassified.ts', 'export const value = 1;'],
])('rejects forbidden dependencies in %s: %s', (file, content) => {
  expect(findViolations([{ path: file, content }]).length).toBeGreaterThan(0);
});

it('allows ports, pure computation libraries, and outer composition', () => {
  expect(
    findViolations([
      { path: 'domain/value.ts', content: "import { lt } from 'semver';" },
      {
        path: 'application/lint.ts',
        content: "import type { RepoContext } from '../domain/ports/repo-context.ts';",
      },
      {
        path: 'adapters/fs.ts',
        content:
          "import type { LintDependencies } from '../application/ports/lint-dependencies.ts'; import fs from 'node:fs';",
      },
      {
        path: 'composition/lint.ts',
        content:
          "import { lint } from '../application/lint.ts'; import { fs } from '../adapters/fs.ts';",
      },
    ]),
  ).toEqual([]);
});
