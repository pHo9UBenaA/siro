import { assertCheckState, bindingForTest } from '../../../helpers/rules.ts';
import { codecFor } from '../../../../src/adapters/codecs/store.ts';
import { asRelPath } from '../../../../src/core/contracts/paths.ts';
import type { Rule, VersionNote } from '../../../../src/core/contracts/rule.ts';
import { makeCtx } from '../../../helpers/ctx.ts';
import { requireConfigKey } from '../../../../src/core/rules/builders/require-config-key.ts';
import { runLint } from '../../../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../../../src/core/parse-config-file.ts';

const buildRule = (options: {
  documentedDefault?: boolean;
  defaultSatisfiedSeverity?: 'error' | 'warn' | 'info' | 'off';
  defaultSafety?: 'unconditional' | 'conditional';
  versionNote?: VersionNote;
}): Rule =>
  requireConfigKey({
    bindings: {
      npm: {
        ...options,
        file: { kind: 'npmrc', path: asRelPath('.npmrc') },
        keyPath: ['enabled'],
        message: 'Enable the policy explicitly.',
        value: true,
      },
    },
    description: 'Require an enabled policy with a documented default.',
    id: 'documented-default',
    severity: 'error',
    title: 'Documented default',
  });

describe('documented defaults', () => {
  it('reports an omitted setting as info when the unconditional default satisfies it', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      targets: [{ pm: 'npm' }],
      ruleSet: [buildRule({ documentedDefault: true, defaultSafety: 'unconditional' })],
    });
    expect(result.findings).toMatchObject([{ severity: 'info' }]);
  });

  it('omits the finding when the satisfied default severity is off', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      targets: [{ pm: 'npm' }],
      ruleSet: [
        buildRule({
          defaultSatisfiedSeverity: 'off',
          documentedDefault: true,
          defaultSafety: 'unconditional',
        }),
      ],
    });
    expect(result.findings).toEqual([]);
  });

  it('keeps rule severity when the default does not satisfy the setting', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      targets: [{ pm: 'npm' }],
      ruleSet: [buildRule({ documentedDefault: false, defaultSafety: 'unconditional' })],
    });
    expect(result.findings).toMatchObject([{ severity: 'error' }]);
  });

  it('does not downgrade a conditional default when the version is unknown', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx(), codecFor),
      targets: [{ pm: 'npm' }],
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
    const binding = bindingForTest(
      buildRule({ documentedDefault: true, defaultSafety: 'unconditional' }),
      'npm',
    );

    const status = binding.check(makeCtx(), { enabled: false });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('accepts an explicitly strong setting', () => {
    const binding = bindingForTest(
      buildRule({ documentedDefault: true, defaultSafety: 'unconditional' }),
      'npm',
    );

    expect(binding.check(makeCtx(), { enabled: true }).state).toBe('ok');
  });
});
