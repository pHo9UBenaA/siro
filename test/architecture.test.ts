import { readFileSync, readdirSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

type Area =
  | 'contracts'
  | 'core'
  | 'adapters'
  | 'composition'
  | 'config-entry'
  | 'cli'
  | 'public'
  | 'metadata';
interface SourceFile {
  readonly path: string;
  readonly content: string;
}

const allowedTargets: Readonly<Record<Area, ReadonlySet<Area>>> = {
  contracts: new Set(),
  core: new Set(['contracts']),
  adapters: new Set(['contracts', 'metadata']),
  composition: new Set(['contracts', 'core', 'adapters', 'metadata']),
  'config-entry': new Set(['contracts', 'core', 'adapters', 'metadata']),
  cli: new Set(['contracts', 'core', 'adapters', 'composition', 'config-entry', 'metadata']),
  public: new Set(['contracts', 'core', 'adapters', 'composition', 'config-entry', 'metadata']),
  metadata: new Set(),
};
const coreAreas = new Set<Area>(['contracts', 'core']);
const noDynamicSelection = new Set<Area>([...coreAreas, 'adapters', 'metadata']);
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
const areaOf = (file: string): Area | undefined => {
  if (file.startsWith('core/contracts/')) return 'contracts';
  if (file.startsWith('core/')) return 'core';
  if (file.startsWith('adapters/')) return 'adapters';
  if (file === 'runtime.ts') return 'composition';
  if (file === 'load-config.ts') return 'config-entry';
  if (file.startsWith('cli/') || file === 'cli.ts') return 'cli';
  if (file === 'index.ts') return 'public';
  if (file === 'version.ts') return 'metadata';
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
    const sourceArea = areaOf(file.path);
    const fail = (reason: string) => violations.push(`${file.path}: ${reason}`);
    if (!sourceArea) {
      fail('unclassified source file');
      continue;
    }
    const inCore = coreAreas.has(sourceArea);
    const inspectImport = (specifier: string) => {
      const packageMetadata = path.resolve(sourceRoot, path.dirname(file.path), specifier);
      if (packageMetadata === path.join(projectRoot, 'package.json')) {
        if (sourceArea !== 'metadata') fail(`forbidden package metadata dependency ${specifier}`);
        return;
      }
      if (sourceArea === 'metadata') {
        fail(`metadata may only read package.json: ${specifier}`);
        return;
      }
      if (isBuiltin(specifier)) {
        if (inCore) fail(`forbidden host dependency ${specifier}`);
        return;
      }
      const resolved = ts.resolveModuleName(
        specifier,
        path.join(sourceRoot, file.path),
        compilerOptions,
        host,
      ).resolvedModule;
      if (!resolved) {
        if (specifier.startsWith('.') || path.isAbsolute(specifier))
          fail(`unresolved source dependency ${specifier}`);
        // Typecheck, build, and package tests establish external availability.
        return;
      }
      const target = path.relative(sourceRoot, resolved.resolvedFileName).split(path.sep).join('/');
      const targetArea = areaOf(target);
      if (!targetArea) fail(`unclassified dependency ${specifier}`);
      else if (targetArea !== sourceArea && !allowedTargets[sourceArea].has(targetArea)) {
        fail(`forbidden ${targetArea} dependency ${specifier}`);
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
        else if (noDynamicSelection.has(sourceArea))
          fail('dynamic module selection in core or driven adapter');
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

it('keeps resolved source imports directed through the contracts', () => {
  expect(findViolations(readSources(sourceRoot))).toEqual([]);
});

it('rejects host dependencies and unclassified files', () => {
  expect(
    findViolations([{ path: 'core/contracts/value.ts', content: "import fs from 'node:fs';" }]),
  ).toHaveLength(1);
  expect(
    findViolations([{ path: 'core/run.ts', content: 'const value = import(name);' }]),
  ).toHaveLength(1);
  expect(
    findViolations([{ path: 'adapters/config.ts', content: 'const value = import(name);' }]),
  ).toHaveLength(1);
  expect(findViolations([{ path: 'unknown.ts', content: 'export const value = 1;' }])).toHaveLength(
    1,
  );
});

it('permits contract runtime validators, ordinary computation, metadata and outer wiring', () => {
  expect(
    findViolations([
      {
        path: 'core/contracts/value.ts',
        content: "import { lt } from 'semver'; export const value = lt('1','2');",
      },
      { path: 'core/contracts/glob.ts', content: 'export interface Glob {}' },
      {
        path: 'adapters/glob.ts',
        content: "import type { Glob } from '../core/contracts/glob.ts'; import fs from 'node:fs';",
      },
      { path: 'core/current.ts', content: 'export const now = Date.now();' },
      { path: 'version.ts', content: "import pkg from '../package.json' with { type: 'json' };" },
      { path: 'adapters/json.ts', content: "import { version } from '../version.ts';" },
      {
        path: 'runtime.ts',
        content: "import { run } from './core/run.ts'; import { version } from './version.ts';",
      },
      { path: 'core/run.ts', content: 'export const run = () => 1;' },
    ]),
  ).toEqual([]);
});

it('rejects adapters to use cases, contracts to use cases, and metadata to code even through types', () => {
  expect(
    findViolations([
      { path: 'core/contracts/port.ts', content: "export type Value = import('../run.ts').Value;" },
      { path: 'core/contracts/barrel.ts', content: "export type { Value } from '../run.ts';" },
      { path: 'adapters/glob.ts', content: "import type { Value } from '../core/run.ts';" },
      { path: 'core/run.ts', content: 'export type Value = string;' },
      { path: 'version.ts', content: "export { Value } from './core/run.ts';" },
    ]),
  ).toEqual([
    'core/contracts/port.ts: forbidden core dependency ../run.ts',
    'core/contracts/barrel.ts: forbidden core dependency ../run.ts',
    'adapters/glob.ts: forbidden core dependency ../core/run.ts',
    'version.ts: metadata may only read package.json: ./core/run.ts',
  ]);
});

it('only allows package.json metadata imports in version.ts', () => {
  expect(
    findViolations([
      {
        path: 'core/contracts/port.ts',
        content: "import pkg from '../../../package.json' with { type: 'json' };",
      },
      {
        path: 'adapters/json.ts',
        content: "import pkg from '../../package.json' with { type: 'json' };",
      },
      { path: 'version.ts', content: "import pkg from '../package.json' with { type: 'json' };" },
    ]),
  ).toEqual([
    'core/contracts/port.ts: forbidden package metadata dependency ../../../package.json',
    'adapters/json.ts: forbidden package metadata dependency ../../package.json',
  ]);
});

it('resolves JavaScript extensions to TypeScript before checking direction', () => {
  expect(
    findViolations([
      { path: 'core/use.ts', content: "import type { Value } from '../adapters/value.js';" },
      { path: 'adapters/value.ts', content: 'export interface Value {}' },
    ]),
  ).toEqual(['core/use.ts: forbidden adapters dependency ../adapters/value.js']);
});

it('rejects unresolved local imports and checks static dynamic and CommonJS references', () => {
  expect(
    findViolations([{ path: 'core/run.ts', content: "export * from './missing.ts';" }]),
  ).toEqual(['core/run.ts: unresolved source dependency ./missing.ts']);
  expect(
    findViolations([
      { path: 'core/run.ts', content: 'const b = import(`../adapters/b.ts`);' },
      { path: 'adapters/b.ts', content: "import c = require('../runtime.ts');" },
      { path: 'runtime.ts', content: 'export const value = 1;' },
    ]),
  ).toEqual([
    'core/run.ts: forbidden adapters dependency ../adapters/b.ts',
    'adapters/b.ts: forbidden composition dependency ../runtime.ts',
  ]);
});
