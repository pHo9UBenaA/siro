import { applyConfig } from '../../../../src/domain/services/apply-config.ts';
import { asRelPath } from '../../../../src/shared/paths.ts';
import assert from 'node:assert';
import type { CodecFor, ConfigCodec } from '../../../../src/domain/ports/config-codec.ts';
import type { ConfigFileRef, Rule } from '../../../../src/domain/entities/rule.ts';
import type { ConfigValue } from '../../../../src/domain/entities/config-value.ts';
import { makeCtx } from '../../../helpers/ctx.ts';
import { requireConfigKey } from '../../../../src/domain/rules/builders/require-config-key.ts';
import { runLint } from '../../../../src/application/run-lint.ts';

const npmrc: ConfigFileRef = { kind: 'npmrc', path: asRelPath('.npmrc') };

// runLint calls parseConfigFile before invoking each binding's `check`. These
// tests target rules whose `check` reads keys via `getByPath`, so the codec
// must produce an empty-but-shaped config (any parsed key is then undefined).
const stubCodecFor: CodecFor = (): ConfigCodec => ({
  parse: (): Record<string, never> => ({}),
});

const buildRule = (opts: {
  documentedDefault?: ConfigValue;
  defaultSatisfiedSeverity?: 'error' | 'warn' | 'info' | 'off';
  accept?: (actual: unknown) => boolean;
  ruleSeverity?: 'error' | 'warn' | 'info';
}): Rule => {
  const npmBinding: {
    file: typeof npmrc;
    keyPath: ['ky'];
    message: string;
    value: boolean;
    documentedDefault?: ConfigValue;
    defaultSatisfiedSeverity?: 'error' | 'warn' | 'info' | 'off';
    accept?: (actual: unknown) => boolean;
  } = { file: npmrc, keyPath: ['ky'], message: 'pin it', value: true };
  if (typeof opts.documentedDefault !== 'undefined') {
    npmBinding.documentedDefault = opts.documentedDefault;
  }
  if (typeof opts.defaultSatisfiedSeverity !== 'undefined') {
    npmBinding.defaultSatisfiedSeverity = opts.defaultSatisfiedSeverity;
  }
  if (opts.accept) {
    npmBinding.accept = opts.accept;
  }
  return requireConfigKey({
    bindings: { npm: npmBinding },
    description: 'd',
    id: 'd2-synthetic',
    severity: opts.ruleSeverity ?? 'error',
    title: 't',
  });
};

describe('documentedDefault — basic behaviour', () => {
  it('1. PM default satisfies + key unset → finding severity is info', () => {
    expect.hasAssertions();
    // documentedDefault === value, so the unset case is "advisory": still a
    // finding (we want users to pin explicitly) but dropped to info.
    const rule = buildRule({ documentedDefault: true });
    const { findings, summary } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: [rule],
    });
    expect(findings).toHaveLength(1);
    const firstFinding1 = findings[0];
    assert(firstFinding1, 'expected finding');
    expect(firstFinding1.severity).toBe('info');
    expect(summary).toStrictEqual({ error: 0, info: 1, warn: 0 });
  });

  it('2. defaultSatisfiedSeverity: "off" + PM default satisfies → no finding', () => {
    expect.hasAssertions();
    // `'off'` is the silent option: the PM default fully mitigates the
    // threat and the user has not asked for explicit pinning either.
    const rule = buildRule({ defaultSatisfiedSeverity: 'off', documentedDefault: true });
    const { findings, summary } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: [rule],
    });
    expect(findings).toHaveLength(0);
    expect(summary).toStrictEqual({ error: 0, info: 0, warn: 0 });
  });

  it('3. PM default does NOT satisfy + key unset → full rule.severity', () => {
    expect.hasAssertions();
    // documentedDefault is set but does not satisfy `value` (or `accept`),
    // so the binding falls through to the normal violation path.
    const rule = buildRule({ documentedDefault: false, ruleSeverity: 'error' });
    const { findings, summary } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: [rule],
    });
    expect(findings).toHaveLength(1);
    const firstFinding3 = findings[0];
    assert(firstFinding3, 'expected finding');
    expect(firstFinding3.severity).toBe('error');
    expect(summary).toStrictEqual({ error: 1, info: 0, warn: 0 });
  });
});

describe('documentedDefault — explicit-value cases', () => {
  it('4. explicit weak value + documentedDefault set → full rule.severity (regression case)', () => {
    expect.hasAssertions();
    // User explicitly wrote a value that fails the requirement; the
    // documentedDefault path must NOT downgrade this — the user actively
    // weakened the policy.
    const rule = buildRule({ documentedDefault: true, ruleSeverity: 'error' });
    const ctx = makeCtx();
    const binding = rule.bindings.npm;
    assert(binding, 'binding missing');
    // No dynamic downgrade — engine should fall back to rule.severity, so the
    // status itself must not carry one.
    const status = binding.check(ctx, { ky: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('5a. explicit strong value + documentedDefault set → check returns ok', () => {
    expect.hasAssertions();
    const rule = buildRule({ documentedDefault: true });
    const npmBd = rule.bindings.npm;
    assert(npmBd, 'expected npm binding');
    const status = npmBd.check(makeCtx(), { ky: true });
    expect(status.state).toBe('ok');
  });

  it('5b. unset value + documentedDefault set → exactly one info finding via runLint', () => {
    expect.hasAssertions();
    const rule = buildRule({ documentedDefault: true });
    const { findings } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: [rule],
    });
    expect(findings).toHaveLength(1);
    const firstFinding5b = findings[0];
    assert(firstFinding5b, 'expected finding');
    expect(firstFinding5b.severity).toBe('info');
  });
});

describe('documentedDefault — override', () => {
  it('6. user override outranks documentedDefault dynamic severity', () => {
    expect.hasAssertions();
    // User wrote `rules: { id: 'warn' }` — siro must honour that even though
    // documentedDefault would otherwise demote to info.
    const rule = buildRule({ documentedDefault: true, ruleSeverity: 'error' });
    const adjusted = applyConfig([rule], { rules: { 'd2-synthetic': 'warn' } });
    const { findings, summary } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: adjusted.rules,
      severityOverrides: adjusted.severityOverrides,
    });
    expect(findings).toHaveLength(1);
    const firstFinding6 = findings[0];
    assert(firstFinding6, 'expected finding');
    expect(firstFinding6.severity).toBe('warn');
    expect(summary).toStrictEqual({ error: 0, info: 0, warn: 1 });
  });
});
