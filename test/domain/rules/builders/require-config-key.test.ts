import assert from 'node:assert';
import type {
  AutoRuleBinding,
  ConfigFileRef,
  Rule,
  VersionNote,
} from '../../../../src/domain/entities/rule.ts';
import {
  overrideBindings,
  requireConfigKey,
} from '../../../../src/domain/rules/builders/require-config-key.ts';
import { asAbsPath, asRelPath } from '../../../../src/shared/paths.ts';
import { CONFIG_FILES } from '../../../../src/domain/entities/config-files.ts';
import type { RepoContext } from '../../../../src/domain/ports/repo-context.ts';
import { applyConfig } from '../../../../src/domain/services/apply-config.ts';
import { makeCtx } from '../../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

const npmrc: ConfigFileRef = { kind: 'npmrc', path: asRelPath('.npmrc') };

const INCREMENT = 1;

let vnCounter = 0;
const vnRule = (versionNote?: VersionNote): Rule => {
  vnCounter += INCREMENT;
  return requireConfigKey({
    bindings: {
      npm: {
        file: npmrc,
        keyPath: ['k'],
        message: 'Pin the key explicitly.',
        value: true,
        versionNote,
      },
    },
    description: 'd',
    id: `vn-${vnCounter}`,
    severity: 'error',
    title: 't',
  });
};

describe('requireConfigKey passes spec.severity into binding (D-1)', () => {
  it('binding.severity reflects spec.severity when provided', () => {
    expect.hasAssertions();
    const rule = requireConfigKey({
      bindings: {
        npm: {
          file: npmrc,
          keyPath: ['x'],
          message: 'm',
          severity: 'info',
          value: true,
        },
      },
      description: 'd',
      id: 'test-d1-set',
      severity: 'error',
      title: 't',
    });
    const npmBdSet = rule.bindings.npm;
    assert(npmBdSet, 'expected npm binding');
    expect(npmBdSet.severity).toBe('info');
  });

  it('binding.severity is undefined when spec.severity is unset', () => {
    expect.hasAssertions();
    const rule = requireConfigKey({
      bindings: {
        npm: { file: npmrc, keyPath: ['x'], message: 'm', value: true },
      },
      description: 'd',
      id: 'test-d1-unset',
      severity: 'error',
      title: 't',
    });
    const npmBdUnset = rule.bindings.npm;
    assert(npmBdUnset, 'expected npm binding');
    expect(npmBdUnset.severity).toBeUndefined();
  });
});

describe('versionNote metadata', () => {
  const binding = (vn?: VersionNote) => {
    const bd = vnRule(vn).bindings.npm;
    assert(bd, 'expected npm binding');
    return bd;
  };

  it('copies structured metadata to the binding', () => {
    expect.hasAssertions();
    expect(binding({ configAvailableSince: 'npm 9.0.0' }).versionNote).toStrictEqual({
      configAvailableSince: 'npm 9.0.0',
    });
  });

  it('leaves metadata absent when the spec omits it', () => {
    expect.hasAssertions();
    expect(binding().versionNote).toBeUndefined();
  });

  it('keeps the check result free of presentation metadata', () => {
    expect.hasAssertions();
    expect(binding({ defaultSafeSince: 'npm 11.0.0' }).check(makeCtx(), {})).toMatchObject({
      message: 'Pin the key explicitly.',
      state: 'violation',
    });
  });
});

describe(overrideBindings, () => {
  const yarnBinding: AutoRuleBinding = {
    check: () => ({ state: 'ok' }),
    file: { kind: 'yaml', path: asRelPath('.yarnrc.yml') },
    fix: () => [],
    fixKind: 'auto',
  };
  const baseRule = requireConfigKey({
    bindings: {
      npm: { file: npmrc, keyPath: ['x'], message: 'm', value: true },
    },
    description: 'd',
    id: 'override-fixture',
    severity: 'warn',
    title: 't',
  });

  it('replaces the named PM binding while leaving others intact', () => {
    expect.hasAssertions();
    const out = overrideBindings(baseRule, { yarn: yarnBinding });
    expect(out.bindings.yarn).toBe(yarnBinding);
    expect(out.bindings.npm).toBe(baseRule.bindings.npm);
  });

  it('returns a fresh rule object so callers cannot mutate the base by accident', () => {
    expect.hasAssertions();
    const out = overrideBindings(baseRule, { yarn: yarnBinding });
    expect(out).not.toBe(baseRule);
    expect(out.bindings).not.toBe(baseRule.bindings);
    expect(baseRule.bindings.yarn).toBeUndefined();
  });

  it('preserves rule-level metadata (id, title, severity, docs)', () => {
    expect.hasAssertions();
    const out = overrideBindings(baseRule, { yarn: yarnBinding });
    expect(out.id).toBe(baseRule.id);
    expect(out.title).toBe(baseRule.title);
    expect(out.severity).toBe(baseRule.severity);
    expect(out.description).toBe(baseRule.description);
  });
});

describe("defaultSatisfiedSeverity 'off' under a user rules override", () => {
  const ctx: RepoContext = {
    exists: () => false,
    packageJson: void 0,
    readText: (): undefined => void 0,
    root: asAbsPath('/repo'),
  };

  it('keeps the unset-and-default-safe case silent even when rules overrides severity', () => {
    expect.hasAssertions();
    const rule = requireConfigKey({
      bindings: {
        npm: {
          defaultSatisfiedSeverity: 'off',
          documentedDefault: true,
          file: CONFIG_FILES.npmrc,
          keyPath: ['k'],
          message: 'm',
          value: true,
        },
      },
      description: 'd',
      id: 'synthetic-off-override',
      severity: 'warn',
      title: 't',
    });
    const configured = applyConfig([rule], { rules: { 'synthetic-off-override': 'error' } });
    const [overridden] = configured.rules;
    assert(overridden, 'expected overridden rule');
    const overriddenBd = overridden.bindings.npm;
    assert(overriddenBd, 'expected npm binding');
    expect(overriddenBd.check(ctx, {})).toStrictEqual({ state: 'ok' });
  });
});

it('rejects legacy extraFix options instead of silently discarding part of a policy', () => {
  const spec = {
    file: CONFIG_FILES.npmrc,
    keyPath: ['enabled'] as const,
    value: true,
    message: 'Enable the policy.',
    extraFix: [{ keyPath: ['second'], value: true }],
  };
  expect(() =>
    requireConfigKey({
      id: 'legacy-options',
      title: 'Legacy',
      description: 'Legacy options',
      severity: 'error',
      bindings: { npm: spec },
    }),
  ).toThrow(/extraFix.*custom binding/u);
});
