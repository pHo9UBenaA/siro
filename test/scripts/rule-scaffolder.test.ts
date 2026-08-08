import {
  insertBuiltinRuleEntries,
  isValidRuleId,
  kebabToCamel,
  renderRuleFile,
} from '../../scripts/gen/lib/rule-scaffolder.ts';

vi.setConfig({ testTimeout: 5000 });

describe(kebabToCamel, () => {
  it('converts kebab-case to camelCase', () => {
    expect.hasAssertions();
    expect(kebabToCamel('frozen-lockfile')).toBe('frozenLockfile');
    expect(kebabToCamel('bun-security-scanner')).toBe('bunSecurityScanner');
  });

  it('leaves single-word ids untouched', () => {
    expect.hasAssertions();
    expect(kebabToCamel('provenance')).toBe('provenance');
  });

  it('handles digit segments', () => {
    expect.hasAssertions();
    expect(kebabToCamel('enforce-2fa')).toBe('enforce2fa');
  });
});

describe(isValidRuleId, () => {
  it('accepts well-formed kebab ids', () => {
    expect.hasAssertions();
    expect(isValidRuleId('frozen-lockfile')).toBe(true);
    expect(isValidRuleId('provenance')).toBe(true);
    expect(isValidRuleId('enforce-2fa')).toBe(true);
  });

  it('rejects malformed ids', () => {
    expect.hasAssertions();
    expect(isValidRuleId('Frozen-Lockfile')).toBe(false);
    expect(isValidRuleId('frozen_lockfile')).toBe(false);
    expect(isValidRuleId('-leading-hyphen')).toBe(false);
    expect(isValidRuleId('trailing-hyphen-')).toBe(false);
    expect(isValidRuleId('1leading-digit')).toBe(false);
    expect(isValidRuleId('')).toBe(false);
  });
});

describe(renderRuleFile, () => {
  it('emits an auto template using requireConfigKey', () => {
    expect.hasAssertions();
    const out = renderRuleFile('enforce-2fa', 'enforce2fa', 'auto');
    expect(out).toContain("import { requireConfigKey } from './builders/require-config-key.ts';");
    expect(out).toContain('export const enforce2fa = requireConfigKey({');
    expect(out).toContain("id: 'enforce-2fa',");
    expect(out).toContain('bindings: {},');
  });

  it('flags the empty bindings stub so an unfinished rule cannot land silently (auto)', () => {
    expect.hasAssertions();
    const out = renderRuleFile('enforce-2fa', 'enforce2fa', 'auto');
    expect(out).toMatch(/TODO\(siro\): bindings are empty/u);
  });

  it('flags the empty bindings stub so an unfinished rule cannot land silently (advisory)', () => {
    expect.hasAssertions();
    const out = renderRuleFile('enforce-2fa', 'enforce2fa', 'advisory');
    expect(out).toMatch(/TODO\(siro\): bindings are empty/u);
  });

  it('emits an advisory template through defineRule', () => {
    expect.hasAssertions();
    const out = renderRuleFile('enforce-2fa', 'enforce2fa', 'advisory');
    expect(out).toContain("import { defineRule } from '../entities/rule.ts';");
    expect(out).toContain('export const enforce2fa = defineRule({');
    expect(out).toContain("id: 'enforce-2fa',");
    expect(out).toContain('});');
  });
});

const BUILTIN_ENTRIES_SOURCE = `import type { Rule } from './entities/rule.ts';
import { disableLifecycleScripts } from './rules/disable-lifecycle-scripts.ts';
import { frozenLockfile } from './rules/frozen-lockfile.ts';
import { provenance } from './rules/provenance.ts';

export const rules = [
  disableLifecycleScripts,
  frozenLockfile,
  provenance,
] as const satisfies readonly Rule[];

export type BuiltinRuleId = (typeof rules)[number]['id'];
`;

describe('insertBuiltinRuleEntries — insertion order', () => {
  it('inserts the import in alphabetical position among ./rules imports', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(BUILTIN_ENTRIES_SOURCE, 'enforce-2fa', 'enforce2fa');
    expect(out).toMatch(
      /\.\/rules\/disable-lifecycle-scripts\.ts'.*\n.*\.\/rules\/enforce-2fa\.ts'.*\n.*\.\/rules\/frozen-lockfile\.ts'/su,
    );
  });

  it('appends the new rule to the ordered rules array', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(BUILTIN_ENTRIES_SOURCE, 'enforce-2fa', 'enforce2fa');
    expect(out).toContain('  provenance,\n  enforce2fa,\n] as const satisfies readonly Rule[];');
  });

  it('refuses an id that is already imported', () => {
    expect.hasAssertions();
    expect(() =>
      insertBuiltinRuleEntries(BUILTIN_ENTRIES_SOURCE, 'provenance', 'provenance'),
    ).toThrow(/already imported/u);
  });

  it('appends when the new id sorts after every existing import', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(BUILTIN_ENTRIES_SOURCE, 'zoo-rule', 'zooRule');
    expect(out).toContain(
      "import { provenance } from './rules/provenance.ts';\nimport { zooRule } from './rules/zoo-rule.ts';",
    );
  });
});

const DIGIT_ENTRIES_SOURCE = `import type { Rule } from './entities/rule.ts';
import { enforce2fa } from './rules/enforce-2fa.ts';

export const rules = [
  enforce2fa,
] as const satisfies readonly Rule[];

export type BuiltinRuleId = (typeof rules)[number]['id'];
`;

const EXTRA_ARRAY_SOURCE = `import type { Rule } from './entities/rule.ts';
import { provenance } from './rules/provenance.ts';

vi.setConfig({ testTimeout: 5000 });

const ADVISORY_RULES = [
  provenance,
] as const satisfies readonly Rule[];

export const rules = [
  provenance,
] as const satisfies readonly Rule[];

export type BuiltinRuleId = (typeof rules)[number]['id'];
`;

describe('insertBuiltinRuleEntries — edge cases', () => {
  it('inserts digit-containing ids in natural order, not lexicographic order', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(DIGIT_ENTRIES_SOURCE, 'enforce-10x', 'enforce10x');
    expect(out).toMatch(/\.\/rules\/enforce-2fa\.ts'.*\n.*\.\/rules\/enforce-10x\.ts'/su);
  });

  it('does not latch onto an earlier rule-shaped array', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(EXTRA_ARRAY_SOURCE, 'enforce-2fa', 'enforce2fa');
    expect(out).toContain(
      'const ADVISORY_RULES = [\n  provenance,\n] as const satisfies readonly Rule[];',
    );
    expect(out).toContain(
      'export const rules = [\n  provenance,\n  enforce2fa,\n] as const satisfies readonly Rule[];',
    );
  });

  it('reports a missing rules array marker', () => {
    expect.hasAssertions();
    expect(() =>
      insertBuiltinRuleEntries("import { rule } from './rules/rule.ts';", 'x', 'x'),
    ).toThrow(/rules array opening/u);
  });
});
