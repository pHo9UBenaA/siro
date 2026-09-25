import assert from 'node:assert';
import { dependencyOverrides } from '../../../src/core/rules/dependency-overrides.ts';
import { makeCtx } from '../../helpers/ctx.ts';
it.each([{}, { overrides: {} }])('accepts no dependency overrides: %j', (config) => {
  expect(dependencyOverrides.bindings.pnpm?.check(makeCtx(), config)).toEqual({ state: 'ok' });
});
it.each([
  ['pnpm', 'pnpm-workspace.yaml'],
  ['aube', 'aube-workspace.yaml'],
] as const)('reports %s overrides for manual review', (pm, file) => {
  const binding = dependencyOverrides.bindings[pm];
  assert(binding);
  const status = binding.check(makeCtx(), { overrides: { foo: '1.0.0' } });
  expect(Object.keys(dependencyOverrides.bindings).sort()).toEqual(['aube', 'pnpm']);
  expect(dependencyOverrides.severity).toBe('info');
  expect(binding.file).toEqual({ kind: 'yaml', path: file });
  expect(status).toMatchObject({
    state: 'violation',
    message: expect.stringContaining(file),
    remediation: { kind: 'manual', steps: expect.any(Array) },
  });
});
