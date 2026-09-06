import { runLint } from '../../src/application/run-lint.ts';
import { codecFor } from '../../src/adapters/codecs/store.ts';
import { makeCtx } from '../helpers/ctx.ts';
import { asRelPath } from '../../src/shared/paths.ts';
import type { Rule } from '../../src/domain/entities/rule.ts';

it('carries the remediation chosen by the check without a second callback', () => {
  const remediation = {
    kind: 'manual',
    steps: ['Remove the bypass before enabling approval.'],
  } as const;
  const check = vi.fn<() => import('../../src/domain/entities/rule.ts').CheckStatus>(() => ({
    state: 'violation',
    message: 'Approval is bypassed',
    remediation,
  }));
  const rule: Rule = {
    id: 'approval',
    title: 'Approval',
    description: 'Require approval',
    severity: 'error',
    bindings: { npm: { file: { kind: 'npmrc', path: asRelPath('.npmrc') }, check } },
  };
  const result = runLint({ ctx: makeCtx(), codecFor, pms: ['npm'], ruleSet: [rule] });
  expect(result.findings[0]).toMatchObject({ remediation });
  expect(result.findings[0]).not.toHaveProperty('fixable');
  expect(result.findings[0]).not.toHaveProperty('fix');
  expect(check).toHaveBeenCalledTimes(1);
});

const operation = {
  op: 'setKey',
  file: { kind: 'npmrc', path: '.npmrc' },
  keyPath: ['enabled'],
  value: true,
};

it.each([
  null,
  { kind: 'automatic', operations: [] },
  { kind: 'automatic', operations: new Array(1) },
  { kind: 'automatic', operations: [operation], steps: ['manual'] },
  { kind: 'automatic', operations: [{ ...operation, value: Infinity }] },
  { kind: 'automatic', operations: [{ ...operation, keyPath: [] }] },
  { kind: 'automatic', operations: [{ ...operation, keyPath: new Array(1) }] },
  { kind: 'automatic', operations: [{ ...operation, file: { kind: 'fileGlob', path: '*.lock' } }] },
  { kind: 'automatic', operations: [{ op: 'note', message: 'manual' }] },
  { kind: 'manual', steps: [] },
  { kind: 'manual', steps: new Array(1) },
  { kind: 'manual', steps: [42] },
  { kind: 'manual', steps: ['manual'], operations: [operation] },
])('rejects invalid or ambiguous remediation: %j', (remediation) => {
  const rule: Rule = {
    id: 'invalid-remedy',
    title: 'Invalid',
    description: 'Invalid',
    severity: 'error',
    bindings: {
      npm: {
        file: { kind: 'npmrc', path: asRelPath('.npmrc') },
        check: () => ({ state: 'violation', message: 'Invalid remedy', remediation }) as never,
      },
    },
  };
  expect(() => runLint({ ctx: makeCtx(), codecFor, pms: ['npm'], ruleSet: [rule] })).toThrow(
    "Rule 'invalid-remedy' returned an invalid check result.",
  );
});

it('allows a finding without a proposed remedy', () => {
  const rule: Rule = {
    id: 'observation',
    title: 'Observation',
    description: 'Observation',
    severity: 'info',
    bindings: {
      npm: {
        file: { kind: 'npmrc', path: asRelPath('.npmrc') },
        check: () => ({ state: 'violation', message: 'Needs investigation' }),
      },
    },
  };
  const result = runLint({ ctx: makeCtx(), codecFor, pms: ['npm'], ruleSet: [rule] });
  expect(result.findings[0]).toMatchObject({ message: 'Needs investigation' });
  expect(result.findings[0]?.remediation).toBeUndefined();
});

it.each(['/outside', '../outside', 'nested/../../outside'])(
  'rejects external write targets: %s',
  (path) => {
    const rule: Rule = {
      id: 'invalid-target',
      title: 'Invalid target',
      description: 'Invalid target',
      severity: 'error',
      bindings: {
        npm: {
          check: () =>
            ({
              state: 'violation',
              message: 'x',
              remediation: {
                kind: 'automatic',
                operations: [{ ...operation, file: { kind: 'npmrc', path } }],
              },
            }) as never,
        },
      },
    };
    expect(() => runLint({ ctx: makeCtx(), codecFor, pms: ['npm'], ruleSet: [rule] })).toThrow(
      /invalid check result/u,
    );
  },
);
