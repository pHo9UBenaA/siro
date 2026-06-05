import { renderComparison, renderRulesDoc } from '../../scripts/gen/lib/doc-generator.ts';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { rules } from '../../src/domain/builtin-rules.ts';

vi.setConfig({ testTimeout: 5000 });

const RULES_DOC = path.join(import.meta.dirname, '..', '..', 'docs', 'rules.md');
const COMPARISON_DOC = path.join(import.meta.dirname, '..', '..', 'docs', 'comparison.md');

describe('docs/rules.md', () => {
  it('stays in sync with the rule registry (run `pnpm gen:rules`)', () => {
    expect.hasAssertions();
    expect(readFileSync(RULES_DOC, 'utf8')).toBe(renderRulesDoc());
  });
});

describe('docs/comparison.md', () => {
  it('stays in sync with the rule registry (run `pnpm gen:comparison`)', () => {
    expect.hasAssertions();
    expect(readFileSync(COMPARISON_DOC, 'utf8')).toBe(renderComparison());
  });

  it('lists every package manager column', () => {
    expect.hasAssertions();
    const md = renderComparison();
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun', 'deno', 'aube']) {
      expect(md).toContain(pm);
    }
  });
});

describe('rule registry order contract', () => {
  it('produces byte-identical output on repeated renders so generators stay deterministic', () => {
    expect.hasAssertions();
    // renderRulesDoc and renderComparison walk the `rules` array in source
    // order. Repeating the call must yield byte-equal output — otherwise the
    // `staysInSync` checks above could pass intermittently while CI commits
    // drift across rebuilds.
    expect(renderRulesDoc()).toBe(renderRulesDoc());
    expect(renderComparison()).toBe(renderComparison());
  });

  it('keeps rule ids unique so the doc renderer can rely on insertion order', () => {
    expect.hasAssertions();
    // The renderer treats `rules` insertion order as the canonical doc order.
    // A duplicate id would make the output non-deterministic per consumer
    // (Map collapse vs. array dedupe) and silently break the contract.
    const ids = rules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
