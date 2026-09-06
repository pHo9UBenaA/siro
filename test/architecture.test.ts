import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const LAYERS = ['shared', 'domain', 'application', 'adapters', 'cli'] as const;
type Layer = (typeof LAYERS)[number];

interface SourceFile {
  readonly path: string;
  readonly content: string;
}

const allowedTargets: Readonly<Record<Layer, ReadonlySet<Layer>>> = {
  shared: new Set(),
  domain: new Set(['shared']),
  application: new Set(['shared', 'domain', 'adapters']),
  adapters: new Set(['shared', 'domain', 'application']),
  cli: new Set(['shared', 'domain', 'application', 'adapters']),
};

const layerOf = (file: string): Layer | undefined => {
  if (file === 'cli.ts' || file.startsWith('cli/')) return 'cli';
  const [first] = file.split('/');
  return LAYERS.find((layer) => layer === first);
};

const moduleSpecifiers = (file: SourceFile): string[] => {
  const source = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const findViolations = (files: readonly SourceFile[]): string[] => {
  const violations: string[] = [];
  for (const file of files) {
    const sourceLayer = layerOf(file.path);
    if (!sourceLayer) continue;
    for (const specifier of moduleSpecifiers(file)) {
      if (sourceLayer === 'domain' && specifier.startsWith('node:')) {
        violations.push(`${file.path} imports runtime builtin ${specifier}`);
        continue;
      }
      if (!specifier.startsWith('.')) continue;
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(file.path), specifier),
      );
      if (target === 'index.ts' || target === 'index.js') {
        if (sourceLayer !== 'cli')
          violations.push(`${file.path} imports public barrel ${specifier}`);
        continue;
      }
      const targetLayer = layerOf(target);
      if (
        targetLayer &&
        targetLayer !== sourceLayer &&
        !allowedTargets[sourceLayer].has(targetLayer)
      ) {
        violations.push(`${file.path} imports ${targetLayer} through ${specifier}`);
      }
    }
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

it('keeps shared and domain code independent from runtime composition', () => {
  const root = path.resolve(import.meta.dirname, '../src');
  expect(findViolations(readSources(root))).toEqual([]);
});

it('detects representative forbidden dependencies through the TypeScript syntax tree', () => {
  expect(
    findViolations([
      { path: 'domain/rule.ts', content: "import fs from 'node:fs';" },
      { path: 'domain/rule.ts', content: "export { value } from '../adapters/value.ts';" },
      { path: 'shared/value.ts', content: "const value = import('../domain/value.ts');" },
      { path: 'application/use-api.ts', content: "export { lint } from '../index.ts';" },
    ]),
  ).toEqual([
    'domain/rule.ts imports runtime builtin node:fs',
    'domain/rule.ts imports adapters through ../adapters/value.ts',
    'shared/value.ts imports domain through ../domain/value.ts',
    'application/use-api.ts imports public barrel ../index.ts',
  ]);
});
