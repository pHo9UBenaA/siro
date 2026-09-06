import { lint } from '../../src/application/lint.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { asAbsPath } from '../../src/shared/paths.ts';

it.each([undefined, 'deno'] as const)('reports unsupported deno.jsonc for pm %s', (pm) => {
  const fs = createMemFileSystem({
    'deno.jsonc': '{ /* config */ "lock": false }',
    'deno.lock': '{}',
  });
  expect(() => lint({ cwd: asAbsPath('/repo'), fs, pm })).toThrow(/deno\.jsonc.*not supported/u);
});

it('follows Deno precedence when deno.json and deno.jsonc are both present', () => {
  const fs = createMemFileSystem({ 'deno.json': '{}', 'deno.jsonc': 'invalid', 'deno.lock': '{}' });
  expect(() => lint({ cwd: asAbsPath('/repo'), fs })).not.toThrow();
});
