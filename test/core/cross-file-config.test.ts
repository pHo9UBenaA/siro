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
import { runLint, type RunLintOptions } from '../../src/core/run-lint.ts';
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
  const readText = vi
    .fn<() => string>()
    .mockReturnValueOnce('approved=true')
    .mockReturnValue('approved=false');
  const ctx = makeCtx({ readText });
  const options = {
    targets: [{ pm: 'npm' }],
    ruleSet: ['first', 'second'].map(
      (id): Rule => ({
        id,
        title: id,
        description: id,
        severity: 'error',
        bindings: {
          npm: {
            check(context: RuleContext) {
              return getByPath(context.readConfig(CONFIG_FILES.npmrc), ['approved']) === true
                ? { state: 'ok' }
                : { state: 'violation', message: 'Approval required.' };
            },
          },
        },
      }),
    ),
  } satisfies Omit<RunLintOptions, 'repository'>;
  expect(
    runLint({ ...options, repository: createRepositoryEvaluation(ctx, codecFor) }).findings,
  ).toEqual([]);
  expect(readText).toHaveBeenCalledOnce();
  expect(
    runLint({ ...options, repository: createRepositoryEvaluation(ctx, codecFor) }).findings,
  ).toHaveLength(2);
  expect(readText).toHaveBeenCalledTimes(2);
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
      const readManifest = vi
        .fn<() => string>()
        .mockReturnValueOnce('{"private":false}')
        .mockReturnValue('{"private":true}');
      const readExtra = vi.fn<() => string>().mockReturnValueOnce('1').mockReturnValue('2');
      const manifest = path.join('/repo', 'package.json');
      const fs: FileSystem = {
        readDirectories: () => [],
        exists: () => false,
        readText: (file) => {
          if (file === path.join('/repo', 'extra.txt')) return readExtra();
          if (file === manifest) return readManifest();
          return undefined;
        },
      };
      const seen: unknown[] = [];
      const snapshotOptions: LintOptions = {
        cwd: asAbsPath('/repo'),
        pm: 'npm',
        fs,
        config: {
          customRules: [
            rule(
              'package-snapshot',
              (ctx, config) => {
                seen.push({
                  manifestPrivate: ctx.packageJson?.private,
                  configPrivate: config.private,
                  extraText: ctx.readText(asRelPath('extra.txt')),
                  aliasedExtraText: ctx.readText(asRelPath('./extra.txt')),
                });
                return { state: 'ok' };
              },
              { ...CONFIG_FILES.packageJson, path: asRelPath(rulePath) },
            ),
          ],
        },
      };
      lint(snapshotOptions);
      const firstSnapshot = {
        manifestPrivate: false,
        configPrivate: false,
        extraText: '1',
        aliasedExtraText: '1',
      };
      expect(seen).toEqual([firstSnapshot]);
      expect(readManifest).toHaveBeenCalledOnce();
      expect(readExtra).toHaveBeenCalledOnce();
      lint(snapshotOptions);
      expect(seen).toEqual([
        firstSnapshot,
        { manifestPrivate: true, configPrivate: true, extraText: '2', aliasedExtraText: '2' },
      ]);
      expect(readManifest).toHaveBeenCalledTimes(2);
      expect(readExtra).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps an absent manifest absent within a scan and re-reads it on the next scan', () => {
    const manifest = path.join('/repo', 'package.json');
    const readManifest = vi
      .fn<() => string | undefined>()
      .mockReturnValueOnce(undefined)
      .mockReturnValue('{"private":true}');
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
          return readManifest();
        },
      },
      config: {
        customRules: [
          rule(
            'absent-manifest',
            (ctx, config) => {
              seen.push({
                manifestPrivate: ctx.packageJson?.private,
                configPrivate: config.private,
              });
              return { state: 'ok' };
            },
            CONFIG_FILES.packageJson,
          ),
        ],
      },
    };
    lint(request);
    expect(seen).toEqual([{ manifestPrivate: undefined, configPrivate: undefined }]);
    expect(readManifest).toHaveBeenCalledOnce();
    lint(request);
    expect(seen).toEqual([
      { manifestPrivate: undefined, configPrivate: undefined },
      { manifestPrivate: true, configPrivate: true },
    ]);
    expect(readManifest).toHaveBeenCalledTimes(2);
  });
});
