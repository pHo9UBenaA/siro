import { applyConfig } from '../../src/domain/services/apply-config.ts';
import { asRelPath } from '../../src/shared/paths.ts';
import assert from 'node:assert';
import type { AutoRuleBinding, Rule } from '../../src/domain/entities/rule.ts';
import type { CodecFor, ConfigCodec } from '../../src/domain/ports/config-codec.ts';
import { makeCtx } from '../helpers/ctx.ts';
import { runLint } from '../../src/application/run-lint.ts';

vi.setConfig({ testTimeout: 5000 });

const SINGLE_FINDING = 1;
const NO_FINDINGS = 0;
const FIRST_ELEMENT = 0;

// runLint calls parseConfigFile before invoking each binding's `check`. Tests
// here use synthetic bindings whose `check` ignores `config`, so any codec
// that never throws is acceptable.
const stubCodecFor: CodecFor = (): ConfigCodec => ({
  parse: (): Record<string, never> => ({}),
});

const makeRule = (opts: {
  ruleSeverity: 'error' | 'warn' | 'info';
  bindingSeverity?: 'error' | 'warn' | 'info';
}): Rule => {
  const binding: AutoRuleBinding = {
    check: () => ({ message: 'always violates', state: 'violation' }),
    file: { kind: 'npmrc', path: asRelPath('.npmrc') },
    fix: () => [],
    fixKind: 'auto',
    severity: opts.bindingSeverity,
  };
  return {
    bindings: { npm: binding },
    description: 'd',
    id: 'synthetic-d1',
    severity: opts.ruleSeverity,
    title: 't',
  };
};

describe('per-binding severity — basic resolution', () => {
  it('uses binding.severity when set', () => {
    expect.hasAssertions();
    const rule = makeRule({ bindingSeverity: 'info', ruleSeverity: 'error' });
    const { findings, summary } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: [rule],
    });
    expect(findings).toHaveLength(SINGLE_FINDING);
    const first = findings[FIRST_ELEMENT];
    assert(first, 'expected finding');
    expect(first.severity).toBe('info');
    expect(summary).toStrictEqual({ error: NO_FINDINGS, info: SINGLE_FINDING, warn: NO_FINDINGS });
  });

  it('falls back to rule.severity when binding.severity is undefined', () => {
    expect.hasAssertions();
    const rule = makeRule({ ruleSeverity: 'error' });
    const { findings, summary } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: [rule],
    });
    expect(findings).toHaveLength(SINGLE_FINDING);
    const first = findings[FIRST_ELEMENT];
    assert(first, 'expected finding');
    expect(first.severity).toBe('error');
    expect(summary).toStrictEqual({ error: SINGLE_FINDING, info: NO_FINDINGS, warn: NO_FINDINGS });
  });
});

describe('per-binding severity — user config override', () => {
  it('user config override outranks binding.severity', () => {
    expect.hasAssertions();
    const rule = makeRule({ bindingSeverity: 'info', ruleSeverity: 'error' });
    const adjusted = applyConfig([rule], { rules: { 'synthetic-d1': 'warn' } });
    const { findings } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: adjusted,
    });
    const first = findings[FIRST_ELEMENT];
    assert(first, 'expected finding');
    expect(first.severity).toBe('warn');
  });

  it('user config override downgrades severity past binding.severity (error+warn → info)', () => {
    expect.hasAssertions();
    const rule = makeRule({ bindingSeverity: 'warn', ruleSeverity: 'error' });
    const adjusted = applyConfig([rule], { rules: { 'synthetic-d1': 'info' } });
    const { findings, summary } = runLint({
      codecFor: stubCodecFor,
      ctx: makeCtx(),
      pms: ['npm'],
      ruleSet: adjusted,
    });
    const first = findings[FIRST_ELEMENT];
    assert(first, 'expected finding');
    expect(first.severity).toBe('info');
    expect(summary).toStrictEqual({ error: NO_FINDINGS, info: SINGLE_FINDING, warn: NO_FINDINGS });
  });

  it('applyConfig does not mutate the input rule or its bindings', () => {
    expect.hasAssertions();
    const rule = makeRule({ bindingSeverity: 'info', ruleSeverity: 'error' });
    const npmBinding = rule.bindings.npm;
    assert(npmBinding, 'expected npm binding');

    applyConfig([rule], { rules: { 'synthetic-d1': 'warn' } });

    expect(npmBinding.severity).toBe('info');
    expect(rule.severity).toBe('error');
  });
});
