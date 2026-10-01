import assert from 'node:assert';
import { codecFor } from '../../../../src/adapters/codecs/store.ts';
import { asRelPath } from '../../../../src/core/contracts/paths.ts';
import type { Rule, VersionNote } from '../../../../src/core/contracts/rule.ts';
import { makeCtx } from '../../../helpers/ctx.ts';
import { requireConfigKey } from '../../../../src/core/rules/builders/require-config-key.ts';
import { runLint } from '../../../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../../../src/core/parse-config-file.ts';

const buildRule = (opts: {
  documentedDefault?: boolean;
  defaultSatisfiedSeverity?: 'error' | 'warn' | 'info' | 'off';
  defaultSafety?: 'unconditional' | 'conditional';
  versionNote?: VersionNote;
}): Rule =>
  requireConfigKey({
    bindings: {
      npm: {
        ...opts,
        file: { kind: 'npmrc', path: asRelPath('.npmrc') },
        keyPath: ['ky'],
        message: 'pin it',
        value: true,
        defaultSafety: opts.defaultSafety ?? 'unconditional',
      },
    },
    description: 'd',
    id: 'documented-default',
    severity: 'error',
    title: 't',
  });

describe('documented defaults', () => {
  it('reports an omitted setting as info when the unconditional default satisfies it', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      pms: ['npm'],
      ruleSet: [buildRule({ documentedDefault: true })],
    });
    expect(result.findings).toMatchObject([{ severity: 'info' }]);
  });

  it('omits the finding when the satisfied default severity is off', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      pms: ['npm'],
      ruleSet: [buildRule({ defaultSatisfiedSeverity: 'off', documentedDefault: true })],
    });
    expect(result.findings).toEqual([]);
  });

  it('keeps rule severity when the default does not satisfy the setting', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      pms: ['npm'],
      ruleSet: [buildRule({ documentedDefault: false })],
    });
    expect(result.findings).toMatchObject([{ severity: 'error' }]);
  });

  it('does not downgrade a conditional default when the version is unknown', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      pms: ['npm'],
      ruleSet: [
        buildRule({
          documentedDefault: true,
          versionNote: { defaultSafeSince: 'npm 12.0.0' },
          defaultSafety: 'conditional',
        }),
      ],
    });
    expect(result.findings).toMatchObject([{ severity: 'error' }]);
  });

  it('does not downgrade an explicitly weak setting', () => {
    const binding = buildRule({ documentedDefault: true }).bindings.npm;
    assert(binding);
    const status = binding.check(makeCtx(), { ky: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('accepts an explicitly strong setting', () => {
    const binding = buildRule({ documentedDefault: true }).bindings.npm;
    assert(binding);
    expect(binding.check(makeCtx(), { ky: true }).state).toBe('ok');
  });
});
