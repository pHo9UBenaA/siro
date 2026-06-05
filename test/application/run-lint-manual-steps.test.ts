import { asAbsPath, asRelPath } from '../../src/shared/paths.ts';
import assert from 'node:assert';
import { codecFor } from '../../src/adapters/codecs/store.ts';
import type { RepoContext } from '../../src/domain/ports/repo-context.ts';
import type { Rule } from '../../src/domain/entities/rule.ts';
import { runLint } from '../../src/application/run-lint.ts';

vi.setConfig({ testTimeout: 5000 });

const MISSING: undefined = JSON.parse('{}')._;
const FIRST_INDEX = 0;

describe('runLint fixable vs manualSteps', () => {
  it('reports fixable=false when the violation carries manualSteps', () => {
    expect.hasAssertions();
    const ctx: RepoContext = {
      exists: () => false,
      packageJson: MISSING,
      readText: () => MISSING,
      root: asAbsPath('/repo'),
    };
    const rule: Rule = {
      bindings: {
        npm: {
          check: () => ({
            manualSteps: ['edit the file by hand'],
            message: 'requires a manual change',
            state: 'violation',
          }),
          file: { kind: 'npmrc', path: asRelPath('.npmrc') },
          fix: () => [],
          fixKind: 'auto',
        },
      },
      description: 'probe',
      id: 'manual-steps-probe',
      severity: 'warn',
      title: 'probe',
    };
    const result = runLint({ codecFor, ctx, pms: ['npm'], ruleSet: [rule] });
    const finding = result.findings[FIRST_INDEX];
    assert(finding, 'expected finding');
    expect(finding.fixable).toBe(false);
  });
});
