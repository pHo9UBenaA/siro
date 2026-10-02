import path from 'node:path';
import {
  asAbsPath,
  asRelPath,
  lint,
  type FileSystem,
  type LintOptions,
  type ConfigFileRef,
  type RuleBinding,
} from '../../src/index.ts';
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
    targets: [{ pm: 'aube' }],
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
    targets: [{ pm: 'npm' }] as const,
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
      targets: [{ pm: 'npm' }],
      ruleSet: [rule],
    }),
  ).toThrow(/deno.json/u);
});

describe('Scan read snapshots', () => {
  const rule = (id: string, check: RuleBinding['check'], file: ConfigFileRef): Rule => ({
    id,
    title: id,
    description: id,
    severity: 'error',
    bindings: { npm: { file, check } },
  });

  it.each(['package.json', './package.json'])(
    'gives manifest metadata and rule config the same package.json source via %s',
    (rulePath) => {
      let reads = 0;
      let extraReads = 0;
      const manifest = path.join('/repo', 'package.json');
      const fs: FileSystem = {
        readDirectories: () => [],
        exists: () => false,
        readText: (file) => {
          if (file === path.join('/repo', 'extra.txt')) return String(++extraReads);
          if (file !== manifest) return undefined;
          reads++;
          return JSON.stringify({ private: reads > 1 });
        },
      };
      const seen: unknown[] = [];
      const snapshotOptions: LintOptions = {
        cwd: asAbsPath('/repo'),
        pm: 'npm' as const,
        fs,
        config: {
          customRules: [
            rule(
              'package-snapshot',
              (ctx, config) => {
                seen.push([
                  ctx.packageJson?.private,
                  config.private,
                  ctx.readText(asRelPath('extra.txt')),
                  ctx.readText(asRelPath('./extra.txt')),
                ]);
                return { state: 'ok' };
              },
              { ...CONFIG_FILES.packageJson, path: asRelPath(rulePath) },
            ),
          ],
        },
      };
      lint(snapshotOptions);
      expect(seen).toEqual([[false, false, '1', '1']]);
      expect(reads).toBe(1);
      expect(extraReads).toBe(1);
      lint(snapshotOptions);
      expect(seen).toEqual([
        [false, false, '1', '1'],
        [true, true, '2', '2'],
      ]);
      expect(reads).toBe(2);
      expect(extraReads).toBe(2);
    },
  );

  it('keeps an absent manifest absent within a scan and re-reads it on the next scan', () => {
    const manifest = path.join('/repo', 'package.json');
    let reads = 0;
    const seen: unknown[] = [];
    const request: LintOptions = {
      cwd: asAbsPath('/repo'),
      pm: 'npm',
      installationRoots: [],
      fs: {
        readDirectories: () => [],
        exists: () => false,
        readText(file) {
          if (file !== manifest) return undefined;
          reads += 1;
          return reads > 1 ? '{"private":true}' : undefined;
        },
      },
      config: {
        customRules: [
          rule(
            'absent-manifest',
            (ctx, config) => {
              seen.push([ctx.packageJson?.private, config.private]);
              return { state: 'ok' };
            },
            CONFIG_FILES.packageJson,
          ),
        ],
      },
    };
    lint(request);
    expect(seen).toEqual([[undefined, undefined]]);
    expect(reads).toBe(1);
    lint(request);
    expect(seen).toEqual([
      [undefined, undefined],
      [true, true],
    ]);
    expect(reads).toBe(2);
  });
});
