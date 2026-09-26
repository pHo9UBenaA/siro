import assert from 'node:assert';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/core/run-lint.ts';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { advisoryCheck } from '../../../src/core/rules/advisory-check.ts';
import { disableLifecycleScripts } from '../../../src/core/rules/disable-lifecycle-scripts.ts';
import { frozenLockfile } from '../../../src/core/rules/frozen-lockfile.ts';
import { trustPolicy } from '../../../src/core/rules/trust-policy.ts';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import { minimumReleaseAge } from '../../helpers/rules.ts';

describe('aube bindings: lifecycle and lockfile rules', () => {
  describe('disable-lifecycle-scripts', () => {
    it.each<ParsedConfig>([{ jailBuilds: false, strictDepBuilds: false }])(
      'accepts paranoid despite individual settings: %j',
      (config) => {
        expect.hasAssertions();
        const bd = disableLifecycleScripts.bindings.aube;
        assert(bd, 'expected binding');
        expect(bd.check(ctx(), { ...config, paranoid: true }).state).toBe('ok');
      },
    );

    it('fix sets both jailBuilds and strictDepBuilds', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
      const status = bd.check(ctx(), {});
      assert(status.state === 'violations');
      expect(status.violations.map((item) => item.file)).toEqual(['aube-workspace.yaml', '.npmrc']);
      const ops = status.violations.flatMap((item) => automaticOperations(item));
      const aubeFile = { kind: 'yaml', path: 'aube-workspace.yaml' };
      expect(ops).toStrictEqual([
        { file: aubeFile, keyPath: ['jailBuilds'], op: 'setKey', value: true },
        {
          file: { kind: 'npmrc', path: '.npmrc' },
          keyPath: ['strictDepBuilds'],
          op: 'setKey',
          value: true,
        },
      ]);
    });
  });
});

describe('aube bindings: frozen-lockfile and minimum-release-age', () => {
  describe('frozen-lockfile', () => {
    it.each<ParsedConfig>([{}, { preferFrozenLockfile: false }, { preferFrozenLockfile: true }])(
      'advises command-level enforcement regardless of the lockfile preference: %j',
      (config) => {
        expect.hasAssertions();
        const bd = frozenLockfile.bindings.aube;
        assert(bd, 'expected binding');
        expect(bd.severity).toBe('info');
        expect(bd.check(ctx(), config)).toMatchObject({
          state: 'violation',
          remediation: {
            kind: 'manual',
            steps: [expect.stringMatching(/aube ci.*aube install --frozen-lockfile/u)],
          },
        });
      },
    );
  });

  describe('minimum-release-age', () => {
    it('reports the Aube default as info and proposes an explicit three-day cooldown', () => {
      const bd = minimumReleaseAge.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
      const status = bd.check(ctx(), {});
      expect(status).toMatchObject({ state: 'violation', severity: 'info' });
      const regression = bd.check(ctx(), { minimumReleaseAge: 0 });
      expect(regression).toMatchObject({ state: 'violation' });
      expect(regression).not.toHaveProperty('severity');
      expect(bd.check(ctx(), { minimumReleaseAge: 1440 }).state).toBe('ok');

      const setKey = automaticOperations(status).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({
        keyPath: ['minimumReleaseAge'],
        value: 4320,
      });
    });
  });
});

it('uses the documented advisory and trust defaults without downgrading explicit opt-outs', () => {
  for (const [source, severity] of [
    ['', 'info'],
    ['advisoryCheck: off\ntrustPolicy: off', 'warn'],
  ] as const) {
    const result = runLint({
      ctx: ctx({ readText: () => source }),
      codecFor,
      pms: ['aube'],
      ruleSet: [advisoryCheck, trustPolicy],
    });
    expect(result.findings.map((finding) => [finding.ruleId, finding.severity])).toEqual([
      ['advisory-check', severity],
      ['trust-policy', severity],
    ]);
  }
});

it.each([
  [{ jailBuilds: true }, {}, '.npmrc', 'strictDepBuilds'],
  [{}, { strictDepBuilds: true }, 'aube-workspace.yaml', 'jailBuilds'],
] as const)(
  'proposes only the independently missing Aube control: %j %j',
  (yaml, npm, file, key) => {
    const status = disableLifecycleScripts.bindings.aube!.check(
      ctx({ readConfig: () => npm }),
      yaml,
    );
    expect(status).toMatchObject({ state: 'violation', file });
    expect(automaticOperations(status)).toEqual([
      {
        file: { path: file, kind: file === '.npmrc' ? 'npmrc' : 'yaml' },
        keyPath: [key],
        op: 'setKey',
        value: true,
      },
    ]);
  },
);

it('keeps the independent Aube proposal automatic when the other file needs manual repair', () => {
  const status = disableLifecycleScripts.bindings.aube!.check(ctx(), {
    jailBuilds: { nested: true },
  });
  assert(status.state === 'violations');
  expect(status.violations.map((item) => [item.file, item.remediation?.kind])).toEqual([
    ['aube-workspace.yaml', 'manual'],
    ['.npmrc', 'automatic'],
  ]);
});
