import { asAbsPath, lint, type PM } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

const evaluate = (pm: PM, files: Record<string, string>) =>
  lint({
    cwd: asAbsPath('/repo'),
    pm,
    workspaces: true,
    fs: {
      ...createMemFileSystem(files),
      readDirectories(dir) {
        const prefix = dir.replaceAll('\\', '/').replace(/^\/repo\/?/u, '');
        const children = Object.keys(files)
          .filter((file) => file.startsWith(prefix ? `${prefix}/` : ''))
          .map((file) => file.slice(prefix ? prefix.length + 1 : 0).split('/'))
          .filter((parts) => parts.length > 1)
          .map((parts) => parts[0]!);
        return [...new Set(children)];
      },
    },
  });
const childFiles = (pm: PM, files: Record<string, string>) =>
  evaluate(pm, files)
    .findings.filter((finding) => finding.ruleId === 'files-field' && finding.file?.includes('/'))
    .map((finding) => finding.file);

it('uses authoritative Aube YAML before pnpm and package.json declarations', () => {
  expect(
    childFiles('aube', {
      'aube-workspace.yaml': 'packages: ["a/*"]',
      'pnpm-workspace.yaml': 'packages: ["p/*"]',
      'package.json': '{"private":true,"workspaces":["j/*"]}',
      'a/pkg/package.json': '{"name":"a"}',
      'p/pkg/package.json': '{"name":"p"}',
      'j/pkg/package.json': '{"name":"j"}',
    }),
  ).toEqual(['a/pkg/package.json']);
});
it.each(['packages: []', 'minimumReleaseAge: 4320'])('Aube YAML %s suppresses fallback', (yaml) => {
  expect(
    childFiles('aube', {
      'aube-workspace.yaml': yaml,
      'package.json': '{"workspaces":["p/*"]}',
      'p/pkg/package.json': '{"name":"p"}',
    }),
  ).toEqual([]);
});
it('keeps Aube descendants when only their ancestor candidate is excluded', () => {
  expect(
    childFiles('aube', {
      'pnpm-workspace.yaml': 'packages: ["p/**", "!p/a"]',
      'p/a/package.json': '{"name":"a"}',
      'p/a/nested/package.json': '{"name":"nested"}',
    }),
  ).toEqual(['p/a/nested/package.json']);
});
it('reads Deno member manifests and respects publish opt-out independently of npm privacy', () => {
  expect(
    childFiles('deno', {
      'deno.json': '{"workspace":["packages/*"]}',
      'packages/public/deno.json': '{"name":"@example/public","exports":"./mod.ts"}',
      'packages/public/package.json': '{"private":true}',
      'packages/private/deno.json': '{"name":"@example/internal","publish":false}',
      'packages/node/package.json': '{"name":"node"}',
    }),
  ).toEqual(['packages/public/deno.json']);
});
it('combines Deno and package.json declarations without duplicating members', () => {
  expect(
    childFiles('deno', {
      'deno.json': '{"workspace":["a"]}',
      'package.json': '{"workspaces":["a","b/*"]}',
      'a/deno.json': '{"name":"@example/a"}',
      'a/package.json': '{}',
      'b/c/deno.json': '{"name":"@example/c"}',
      'b/c/package.json': '{}',
      'b/deno-only/deno.json': '{"name":"@example/skip"}',
    }),
  ).toEqual(['a/deno.json', 'b/c/deno.json']);
});
it('fails explicitly for selected Deno JSONC or nested workspaces', () => {
  expect(() =>
    evaluate('deno', { 'deno.json': '{"workspace":["a"]}', 'a/deno.jsonc': '{}' }),
  ).toThrow(/deno.jsonc/u);
  expect(() =>
    evaluate('deno', { 'deno.json': '{"workspace":["a"]}', 'a/deno.json': '{"workspace":["b"]}' }),
  ).toThrow(/nested workspace/iu);
});
it('rejects Aube forms whose Rust semantics are not implemented', () => {
  for (const pattern of ['p/{a,b}', 'p/[ab]', 'p/*/**']) {
    expect(() =>
      evaluate('aube', { 'aube-workspace.yaml': JSON.stringify({ packages: [pattern] }) }),
    ).toThrow(/not yet supported/u);
  }
});
it('Aube negative stars span path separators without pruning other candidates', () => {
  expect(
    childFiles('aube', {
      'aube-workspace.yaml': 'packages: ["p/**", "!p/a*"]',
      'p/abc/nested/package.json': '{"name":"a"}',
      'p/b/package.json': '{"name":"b"}',
    }),
  ).toEqual(['p/b/package.json']);
});
it('treats Deno bracket directory names literally and honors pattern reinclusion', () => {
  expect(
    childFiles('deno', {
      'deno.json': '{"workspace":["p/*", "!p/a*", "p/ab?", "p/[id]"]}',
      'p/abc/deno.json': '{"name":"@example/a"}',
      'p/ax/deno.json': '{"name":"@example/skip"}',
      'p/[id]/deno.json': '{"name":"@example/b"}',
    }),
  ).toEqual(['p/[id]/deno.json', 'p/abc/deno.json']);
});
it('rejects a Deno glob that includes its own root', () => {
  expect(() => evaluate('deno', { 'deno.json': '{"workspace":["**"]}' })).toThrow(
    /cannot contain itself/u,
  );
});
it('skips npm glob candidates without package.json before opening Deno JSONC', () => {
  expect(
    childFiles('deno', { 'package.json': '{"workspaces":["p/*"]}', 'p/a/deno.jsonc': 'not JSON' }),
  ).toEqual([]);
  expect(() =>
    evaluate('deno', { 'package.json': '{"workspaces":["p/a"]}', 'p/a/deno.json': '{}' }),
  ).toThrow(/no package.json/u);
});
it('validates excluded patterns even without a positive member glob', () => {
  expect(() => evaluate('aube', { 'aube-workspace.yaml': 'packages: ["!a[broken"]' })).toThrow(
    /not yet supported/u,
  );
});
it('Deno vendor mode excludes globbed copies but keeps explicit members', () => {
  const files = {
    'deno.json': '{"vendor":true,"workspace":["**", "!."]}',
    'vendor/a/deno.json': '{"name":"@example/copied"}',
    'p/a/deno.json': '{"name":"@example/a"}',
  };
  expect(childFiles('deno', files)).toEqual(['p/a/deno.json']);
  expect(
    childFiles('deno', { ...files, 'deno.json': '{"vendor":true,"workspace":["vendor/a"]}' }),
  ).toEqual(['vendor/a/deno.json']);
});
