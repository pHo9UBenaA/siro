import {
  insertBuiltinRuleEntries,
  insertRuleIdEntry,
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

  it('emits an advisory template using a bare Rule literal', () => {
    expect.hasAssertions();
    const out = renderRuleFile('enforce-2fa', 'enforce2fa', 'advisory');
    expect(out).toContain("import type { Rule } from '../entities/rule.ts';");
    expect(out).toContain('export const enforce2fa: Rule = {');
    expect(out).toContain("id: 'enforce-2fa',");
  });
});

const RULE_ID_SOURCE = `export const BUILTIN_RULE_IDS = [
  'disable-lifecycle-scripts',
  'frozen-lockfile',
  'provenance',
] as const;

export type BuiltinRuleId = (typeof BUILTIN_RULE_IDS)[number];
`;

describe(insertRuleIdEntry, () => {
  describe('basic operations', () => {
    it('appends a new id at the end of the array', () => {
      expect.hasAssertions();
      const out = insertRuleIdEntry(RULE_ID_SOURCE, 'enforce-2fa');
      expect(out).toContain("  'provenance',\n  'enforce-2fa',\n] as const;");
    });

    it('refuses duplicates', () => {
      expect.hasAssertions();
      expect(() => insertRuleIdEntry(RULE_ID_SOURCE, 'provenance')).toThrow(/already present/u);
    });

    it('throws with the missing marker name when the array is missing', () => {
      expect.hasAssertions();
      expect(() => insertRuleIdEntry('// no array here', 'enforce-2fa')).toThrow(
        /BUILTIN_RULE_IDS opening/u,
      );
    });
  });

  describe('ambiguous anchors', () => {
    it('does not latch onto an earlier `] as const;` that closes a different array', () => {
      expect.hasAssertions();
      const sourceWithExtra = `export const KNOWN_REPORTERS = [
  'pretty',
  'json',
] as const;

export const BUILTIN_RULE_IDS = [
  'provenance',
] as const;
`;
      const out = insertRuleIdEntry(sourceWithExtra, 'enforce-2fa');
      expect(out).toContain(
        "export const KNOWN_REPORTERS = [\n  'pretty',\n  'json',\n] as const;",
      );
      expect(out).toContain(
        "export const BUILTIN_RULE_IDS = [\n  'provenance',\n  'enforce-2fa',\n] as const;",
      );
    });

    it('ignores a commented-out marker so it cannot anchor the splice', () => {
      expect.hasAssertions();
      const sourceWithComment = `// example: export const BUILTIN_RULE_IDS = ['fake'] as const;
export const BUILTIN_RULE_IDS = [
  'provenance',
] as const;
`;
      const out = insertRuleIdEntry(sourceWithComment, 'enforce-2fa');
      expect(out).toContain("  'provenance',\n  'enforce-2fa',\n] as const;");
      expect(out).toContain("// example: export const BUILTIN_RULE_IDS = ['fake'] as const;");
    });
  });
});

const BUILTIN_ENTRIES_SOURCE = `import type { Rule } from './entities/rule.ts';
import type { BuiltinRuleId } from './entities/rule-id.ts';
import { disableLifecycleScripts } from './rules/disable-lifecycle-scripts.ts';
import { frozenLockfile } from './rules/frozen-lockfile.ts';
import { provenance } from './rules/provenance.ts';

const RULE_REGISTRY = {
  'disable-lifecycle-scripts': disableLifecycleScripts,
  'frozen-lockfile': frozenLockfile,
  provenance,
} as const satisfies Record<BuiltinRuleId, Rule>;

export const rules: readonly Rule[] = Object.values(RULE_REGISTRY);
`;

describe('insertBuiltinRuleEntries — insertion order', () => {
  it('inserts the import in alphabetical position among ./rules imports', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(BUILTIN_ENTRIES_SOURCE, 'enforce-2fa', 'enforce2fa');
    expect(out).toMatch(
      /\.\/rules\/disable-lifecycle-scripts\.ts'.*\n.*\.\/rules\/enforce-2fa\.ts'.*\n.*\.\/rules\/frozen-lockfile\.ts'/su,
    );
  });

  it('appends the new entry to RULE_REGISTRY using the quoted-key form', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(BUILTIN_ENTRIES_SOURCE, 'enforce-2fa', 'enforce2fa');
    expect(out).toContain(
      "  provenance,\n  'enforce-2fa': enforce2fa,\n} as const satisfies Record<BuiltinRuleId, Rule>;",
    );
  });

  it('uses shorthand when the kebab id equals the camel identifier', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(BUILTIN_ENTRIES_SOURCE, 'audit', 'audit');
    expect(out).toContain(
      '  provenance,\n  audit,\n} as const satisfies Record<BuiltinRuleId, Rule>;',
    );
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
import type { BuiltinRuleId } from './entities/rule-id.ts';
import { enforce2fa } from './rules/enforce-2fa.ts';

const RULE_REGISTRY = {
  'enforce-2fa': enforce2fa,
} as const satisfies Record<BuiltinRuleId, Rule>;

export const rules: readonly Rule[] = Object.values(RULE_REGISTRY);
`;

const EXTRA_OBJECT_SOURCE = `import type { Rule } from './entities/rule.ts';
import type { BuiltinRuleId } from './entities/rule-id.ts';
import { provenance } from './rules/provenance.ts';

vi.setConfig({ testTimeout: 5000 });

const ADVISORY_RULES = {
  provenance,
} as const;

const RULE_REGISTRY = {
  provenance,
} as const satisfies Record<BuiltinRuleId, Rule>;

export const rules: readonly Rule[] = Object.values(RULE_REGISTRY);
`;

describe('insertBuiltinRuleEntries — edge cases', () => {
  it('inserts digit-containing ids in natural order, not lexicographic order', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(DIGIT_ENTRIES_SOURCE, 'enforce-10x', 'enforce10x');
    expect(out).toMatch(/\.\/rules\/enforce-2fa\.ts'.*\n.*\.\/rules\/enforce-10x\.ts'/su);
  });

  it('does not latch onto an earlier `};` that closes a different object', () => {
    expect.hasAssertions();
    const out = insertBuiltinRuleEntries(EXTRA_OBJECT_SOURCE, 'enforce-2fa', 'enforce2fa');
    expect(out).toContain('const ADVISORY_RULES = {\n  provenance,\n} as const;');
    expect(out).toContain(
      "const RULE_REGISTRY = {\n  provenance,\n  'enforce-2fa': enforce2fa,\n} as const satisfies Record<BuiltinRuleId, Rule>;",
    );
  });
});
