import { CONFIG_FILES } from '../../src/core/config-files.ts';
import { getByPath } from '../../src/core/contracts/config-value.ts';
import type { Rule } from '../../src/core/contracts/rule.ts';
import type { RuleContext } from '../../src/core/contracts/repo-context.ts';
import { runLint } from '../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../src/core/parse-config-file.ts';
import { codecFor } from '../../src/adapters/codecs/store.ts';
import { disableLifecycleScripts } from '../../src/core/rules/disable-lifecycle-scripts.ts';
import { makeCtx } from '../helpers/ctx.ts';

it.each([
  { workspace: 'jailBuilds: true\nstrictDepBuilds: true\n', npmrc: '', violations: 1 },
  { workspace: 'jailBuilds: true\n', npmrc: 'strictDepBuilds=true\n', violations: 0 },
])('reads Aube strictDepBuilds from .npmrc: %j', ({ workspace, npmrc, violations }) => {
  const result = runLint({
    repository: createRepositoryEvaluation(
      makeCtx({ readText: (file) => (file === '.npmrc' ? npmrc : workspace) }),
      codecFor,
    ),
    pms: ['aube'],
    ruleSet: [disableLifecycleScripts],
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
    pms: ['npm'] as const,
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
  expect(
    runLint({ ...options, repository: createRepositoryEvaluation(ctx, codecFor) }).findings,
  ).toEqual([]);
  expect(reads).toBe(1);
  content = 'approved=false';
  expect(
    runLint({ ...options, repository: createRepositoryEvaluation(ctx, codecFor) }).findings,
  ).toHaveLength(2);
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
    runLint({
      repository: createRepositoryEvaluation(makeCtx({ readText: () => '[' }), codecFor),
      pms: ['npm'],
      ruleSet: [rule],
    }),
  ).toThrow(/deno.json/u);
});
