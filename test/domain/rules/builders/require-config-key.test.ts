import assert from 'node:assert';
import type {
  AutoRuleBinding,
  CheckStatus,
  ConfigFileRef,
  Rule,
} from '../../../../src/domain/entities/rule.ts';
import {
  type VersionNote,
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
const EMPTY = 0;

const acceptPositiveNumber = (val: unknown): boolean => typeof val === 'number' && val > EMPTY;

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

describe('versionNote — single-field and absent rendering (D-3)', () => {
  const check = (vn?: VersionNote): CheckStatus => {
    const bd = vnRule(vn).bindings.npm;
    assert(bd, 'expected npm binding');
    return bd.check(makeCtx(), {});
  };

  it('appends "available since" when only configAvailableSince is set', () => {
    expect.hasAssertions();
    expect(check({ configAvailableSince: 'npm 9.0.0' })).toMatchObject({
      message: 'Pin the key explicitly. (available since npm 9.0.0)',
      state: 'violation',
    });
  });

  it('appends "default safe since" when only defaultSafeSince is set', () => {
    expect.hasAssertions();
    expect(check({ defaultSafeSince: 'npm 11.0.0' })).toMatchObject({
      message: 'Pin the key explicitly. (default safe since npm 11.0.0)',
      state: 'violation',
    });
  });

  it('passes the message through unchanged when versionNote is absent', () => {
    expect.hasAssertions();
    expect(check()).toMatchObject({ message: 'Pin the key explicitly.', state: 'violation' });
  });
});

describe('versionNote — multi-field rendering (D-3)', () => {
  const check = (vn?: VersionNote): CheckStatus => {
    const bd = vnRule(vn).bindings.npm;
    assert(bd, 'expected npm binding');
    return bd.check(makeCtx(), {});
  };

  it('joins both fields with "; " inside a single parenthesised suffix', () => {
    expect.hasAssertions();
    expect(
      check({ configAvailableSince: 'npm 9.0.0', defaultSafeSince: 'npm 11.0.0' }),
    ).toMatchObject({
      message: 'Pin the key explicitly. (available since npm 9.0.0; default safe since npm 11.0.0)',
      state: 'violation',
    });
  });

  it('appends a free-form note after the structured fields', () => {
    expect.hasAssertions();
    expect(
      check({ configAvailableSince: 'npm 9.0.0', note: 'replaces legacy-flag' }),
    ).toMatchObject({
      message: 'Pin the key explicitly. (available since npm 9.0.0; replaces legacy-flag)',
      state: 'violation',
    });
  });

  it('locks rendering order when all three versionNote fields are set', () => {
    expect.hasAssertions();
    const vn = {
      configAvailableSince: 'npm 9.0.0',
      defaultSafeSince: 'npm 11.0.0',
      note: 'replaces legacy-flag',
    };
    expect(check(vn)).toMatchObject({
      message:
        'Pin the key explicitly. (available since npm 9.0.0; default safe since npm 11.0.0; replaces legacy-flag)',
      state: 'violation',
    });
  });
});

describe('versionNote — accept / documentedDefault advisory path (D-3)', () => {
  it('renders the suffix on the accept-based documentedDefault advisory path', () => {
    expect.hasAssertions();
    vnCounter += INCREMENT;
    const rule = requireConfigKey({
      bindings: {
        npm: {
          accept: acceptPositiveNumber,
          documentedDefault: 1440,
          file: npmrc,
          keyPath: ['k'],
          message: 'Pin the key explicitly.',
          value: 1440,
          versionNote: { defaultSafeSince: 'npm 11.0.0' },
        },
      },
      description: 'd',
      id: `vn-accept-${vnCounter}`,
      severity: 'error',
      title: 't',
    });
    const acceptBd = rule.bindings.npm;
    assert(acceptBd, 'expected npm binding');
    expect(acceptBd.check(makeCtx(), {})).toMatchObject({
      message: 'Pin the key explicitly. (default safe since npm 11.0.0)',
      severity: 'info',
      state: 'violation',
    });
  });

  it('also renders the suffix on the documentedDefault advisory path', () => {
    expect.hasAssertions();
    vnCounter += INCREMENT;
    const rule = requireConfigKey({
      bindings: {
        npm: {
          documentedDefault: true,
          file: npmrc,
          keyPath: ['k'],
          message: 'Pin the key explicitly.',
          value: true,
          versionNote: { configAvailableSince: 'npm 9.0.0', defaultSafeSince: 'npm 11.0.0' },
        },
      },
      description: 'd',
      id: `vn-dd-${vnCounter}`,
      severity: 'error',
      title: 't',
    });
    const ddBd = rule.bindings.npm;
    assert(ddBd, 'expected npm binding');
    expect(ddBd.check(makeCtx(), {})).toMatchObject({
      message: 'Pin the key explicitly. (available since npm 9.0.0; default safe since npm 11.0.0)',
      severity: 'info',
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

// A binding with BOTH a documentedDefault (unset primary -> advisory) AND an
// extraFix. The extra must be checked unconditionally: a default-satisfied
// primary must not let an unmet extra pass as advisory, or the fix ops would
// re-write the extra every run while lint reported "fine".
const buildExtraFixBinding = (): AutoRuleBinding => {
  const bd = requireConfigKey({
    bindings: {
      npm: {
        documentedDefault: true,
        extraFix: [{ keyPath: ['save-prefix'], value: '' }],
        file: npmrc,
        keyPath: ['save-exact'],
        message: 'm',
        value: true,
      },
    },
    description: 'd',
    id: 'c16',
    severity: 'warn',
    title: 't',
  }).bindings.npm;
  assert(bd?.fixKind === 'auto', 'expected auto binding');
  return bd;
};

describe('extraFix — default-satisfied primary with extraFix (D15)', () => {
  it('full violation when the primary is default-satisfied but an extra is unmet', () => {
    expect.hasAssertions();
    const res = buildExtraFixBinding().check(makeCtx(), { 'save-prefix': 'tilde' });
    assert(res.state === 'violation');
    expect(res.severity).toBeUndefined();
  });

  it('advisory when the primary is default-satisfied and the extra is met', () => {
    expect.hasAssertions();
    const res = buildExtraFixBinding().check(makeCtx(), { 'save-prefix': '' });
    expect(res).toMatchObject({ severity: 'info', state: 'violation' });
  });
});

describe('extraFix — primary key surfacing without documentedDefault (D15)', () => {
  it('surfaces the primary key (not an extra) when both are unset and no documentedDefault', () => {
    expect.hasAssertions();
    const bdRaw = requireConfigKey({
      bindings: {
        npm: {
          extraFix: [{ keyPath: ['save-prefix'], value: '' }],
          file: npmrc,
          keyPath: ['save-exact'],
          message: 'm',
          value: true,
        },
      },
      description: 'd',
      id: 'primary-first',
      severity: 'error',
      title: 't',
    }).bindings.npm;
    assert(bdRaw?.fixKind === 'auto', 'expected auto binding');
    const bd: AutoRuleBinding = bdRaw;
    expect(bd.check(makeCtx(), {})).toMatchObject({
      actual: void 0,
      expected: true,
      state: 'violation',
    });
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
    const [overridden] = applyConfig([rule], { rules: { 'synthetic-off-override': 'error' } });
    assert(overridden, 'expected overridden rule');
    const overriddenBd = overridden.bindings.npm;
    assert(overriddenBd, 'expected npm binding');
    expect(overriddenBd.check(ctx, {})).toStrictEqual({ state: 'ok' });
  });
});
