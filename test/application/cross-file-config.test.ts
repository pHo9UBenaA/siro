import { CONFIG_FILES } from '../../src/domain/entities/config-files.ts';
import { getByPath } from '../../src/domain/entities/config-value.ts';
import type { Rule } from '../../src/domain/entities/rule.ts';
import type { RuleContext } from '../../src/domain/ports/repo-context.ts';
import { runLint } from '../../src/application/run-lint.ts';
import { codecFor } from '../../src/adapters/codecs/store.ts';
import { disableLifecycleScripts } from '../../src/domain/rules/disable-lifecycle-scripts.ts';
import { makeCtx } from '../helpers/ctx.ts';

it.each([
  { workspace: 'jailBuilds: true\nstrictDepBuilds: true\n', npmrc: '', violations: 1 },
  { workspace: 'jailBuilds: true\n', npmrc: 'strictDepBuilds=true\n', violations: 0 },
])('reads Aube strictDepBuilds from .npmrc: %j', ({ workspace, npmrc, violations }) => {
  const result = runLint({
    ctx: makeCtx({ readText: (file) => (file === '.npmrc' ? npmrc : workspace) }),
    pms: ['aube'],
    ruleSet: [disableLifecycleScripts],
    codecFor,
  });
  expect(result.findings).toHaveLength(violations);
  expect(result.findings.map(({ file }) => file)).toEqual(Array(violations).fill('.npmrc'));
});

it('shares additional file parsing across rules and refreshes it on the next run', () => {
  let content = 'approved=true';
  let reads = 0;
  const ctx = makeCtx({
    readText: () => {
      reads += 1;
      return content;
    },
  });
  const options = {
    ctx,
    pms: ['npm'] as const,
    codecFor,
    ruleSet: ['first', 'second'].map((id) => ({
      id,
      title: id,
      description: id,
      severity: 'error' as const,
      bindings: {
        npm: {
          check(context: RuleContext) {
            return getByPath(context.readConfig(CONFIG_FILES.npmrc), ['approved']) === true
              ? { state: 'ok' as const }
              : { state: 'violation' as const, message: 'Approval required.' };
          },
        },
      },
    })),
  };
  expect(runLint(options).findings).toEqual([]);
  expect(reads).toBe(1);
  content = 'approved=false';
  expect(runLint(options).findings).toHaveLength(2);
  expect(reads).toBe(2);
});

it('propagates a parse failure from an additional configuration file', () => {
  const rule: Rule = {
    id: 'extra-input',
    title: 'Extra input',
    description: 'Read another file',
    severity: 'error',
    bindings: {
      npm: {
        check(ctx) {
          ctx.readConfig(CONFIG_FILES.denoJson);
          return { state: 'ok' };
        },
      },
    },
  };
  expect(() =>
    runLint({ ctx: makeCtx({ readText: () => '[' }), pms: ['npm'], ruleSet: [rule], codecFor }),
  ).toThrow(/deno.json/u);
});
