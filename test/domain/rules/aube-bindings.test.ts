import { advisoryCheck } from '../../../src/domain/rules/advisory-check.ts';
import { trustPolicy } from '../../../src/domain/rules/trust-policy.ts';
import { runLint } from '../../../src/application/run-lint.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import {
  DOCUMENTED_DEFAULT_MINUTES,
  RECOMMENDED_RELEASE_AGE_MINUTES,
  minimumReleaseAge,
} from '../../../src/domain/rules/minimum-release-age.ts';
import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/domain/entities/config-value.ts';
import { commitLockfile } from '../../../src/domain/rules/commit-lockfile.ts';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { expectDocumentedDefaultDynamicInfo } from '../../helpers/binding-expectations.ts';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';

describe('aube bindings: lifecycle and lockfile rules', () => {
  describe('disable-lifecycle-scripts', () => {
    it.each<ParsedConfig>([{}, { jailBuilds: false, strictDepBuilds: false }])(
      'accepts paranoid despite individual settings: %j',
      (config) => {
        expect.hasAssertions();
        const bd = disableLifecycleScripts.bindings.aube;
        assert(bd, 'expected binding');
        expect(bd.check(ctx(), { ...config, paranoid: true }).state).toBe('ok');
      },
    );

    it.each<ParsedConfig>([{}, { paranoid: false }])(
      'requires jailBuilds when paranoid is not enabled: %j',
      (config) => {
        expect.hasAssertions();
        const bd = disableLifecycleScripts.bindings.aube;
        assert(bd, 'expected binding');
        expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
        expect(bd.check(ctx(), config).state).toBe('violations');
      },
    );

    it('requires strictDepBuilds in .npmrc alongside jailBuilds', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), { jailBuilds: true }).state).toBe('violation');
      expect(bd.check(ctx(), { strictDepBuilds: true }).state).toBe('violations');
      expect(bd.check(ctx(), { jailBuilds: true, strictDepBuilds: true }).state).toBe('violation');
      expect(
        bd.check(ctx({ readText: () => 'strictDepBuilds=true' }), { jailBuilds: true }).state,
      ).toBe('ok');
    });

    it('fix sets both jailBuilds and strictDepBuilds', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.aube;
      assert(bd, 'expected binding');
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

  describe('commit-lockfile', () => {
    it('accepts a reused pnpm-lock.yaml as the aube lockfile', () => {
      expect.hasAssertions();
      const bd = commitLockfile.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.check(ctx({ exists: (fp) => fp === 'pnpm-lock.yaml' }), {}).state).toBe('ok');
    });

    it('files-field applies to aube', () => {
      expect.hasAssertions();
      const bd = filesField.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), {}).state).toBe('violation');
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
    it('unset → dynamic info via documentedDefault', () => {
      expect.hasAssertions();
      const bd = minimumReleaseAge.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
      expectDocumentedDefaultDynamicInfo(bd, ctx());
      const regression = bd.check(ctx(), { minimumReleaseAge: 0 });
      expect(regression).toMatchObject({ state: 'violation' });
      expect(regression).not.toHaveProperty('severity');
      expect(bd.check(ctx(), { minimumReleaseAge: DOCUMENTED_DEFAULT_MINUTES }).state).toBe('ok');
    });

    it('fix recommends the recommended release age', () => {
      expect.hasAssertions();
      const bd = minimumReleaseAge.bindings.aube;
      assert(bd, 'expected binding');
      const setKey = automaticOperations(bd.check(ctx(), {})).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({
        keyPath: ['minimumReleaseAge'],
        value: RECOMMENDED_RELEASE_AGE_MINUTES,
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
