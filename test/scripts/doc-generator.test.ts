import { renderComparison, renderRulesDoc } from '../../scripts/gen/lib/doc-generator.ts';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { rules } from '../../src/domain/builtin-rules.ts';

vi.setConfig({ testTimeout: 5000 });

const RULES_DOC = path.join(import.meta.dirname, '..', '..', 'docs', 'rules.md');
const COMPARISON_DOC = path.join(import.meta.dirname, '..', '..', 'docs', 'comparison.md');
const VERSION_MATRIX_DOC = path.join(import.meta.dirname, '..', '..', 'docs', 'version-matrix.md');
const FIRST_TABLE_CELL = 1;
const BEFORE_TRAILING_SEPARATOR = -1;
const AVAILABLE_SINCE_CELL = 2;
const AFTER_DEFAULT_SAFE_CELL = 4;

const getRuleSection = (markdown: string, ruleId: string): string | undefined => {
  const heading = `## \`${ruleId}\``;
  const start = markdown.indexOf(heading);
  if (start < 0) {
    return void 0;
  }
  const next = markdown.indexOf('\n## ', start + heading.length);
  if (next < 0) {
    return markdown.slice(start);
  }
  return markdown.slice(start, next);
};

const getPmRows = (section: string): ReadonlyMap<string, string> => {
  const rows = new Map<string, string>();
  for (const line of section.split('\n')) {
    const match = /^\|\s*(?<pm>[a-z]+)\s*\|/u.exec(line);
    if (match?.groups?.pm) {
      rows.set(match.groups.pm, line);
    }
  }
  return rows;
};

const findMissingBindingRows = (markdown: string): readonly string[] =>
  rules.flatMap((rule) => {
    const section = getRuleSection(markdown, rule.id);
    if (typeof section === 'undefined') {
      return [];
    }
    const rows = getPmRows(section);
    return Object.keys(rule.bindings)
      .filter((pm) => !rows.has(pm))
      .map((pm) => `${rule.id} × ${pm}`);
  });

const findMissingVersionFacts = (markdown: string): readonly string[] =>
  rules.flatMap((rule) =>
    Object.entries(rule.bindings).flatMap(([pm, binding]) => {
      const notes = Object.values(binding?.versionNote ?? {});
      const section = getRuleSection(markdown, rule.id);
      const row = getPmRows(section ?? '').get(pm) ?? '';
      return notes.flatMap((note) =>
        [...note.matchAll(/(?:npm|pnpm|yarn|bun|deno|aube) \d+(?:\.\d+){1,2}/giu)]
          .map(([version]) => version)
          .filter((version) => !row.includes(version))
          .map((version) => `${rule.id} × ${pm}: ${version}`),
      );
    }),
  );

const findConfirmedFactsWithoutMetadata = (markdown: string): readonly string[] =>
  rules.flatMap((rule) => {
    const section = getRuleSection(markdown, rule.id);
    const rows = getPmRows(section ?? '');
    return Object.entries(rule.bindings).flatMap(([pm, binding]) => {
      const row = rows.get(pm) ?? '';
      const cells = row.split('|').slice(FIRST_TABLE_CELL, BEFORE_TRAILING_SEPARATOR);
      const versionCells = cells
        .slice(AVAILABLE_SINCE_CELL, AFTER_DEFAULT_SAFE_CELL)
        .filter((cell) => !/^\s*(?:TBD|n\/a|predates)/iu.test(cell));
      const metadata = Object.values(binding?.versionNote ?? {}).join(' ');
      return versionCells.flatMap((cell) =>
        [
          ...cell.matchAll(
            /\*\*(?<version>(?:npm|pnpm|yarn|bun|deno|aube) \d+(?:\.\d+){1,2})\*\*/giu,
          ),
        ]
          .map((match) => match.groups?.version ?? '')
          .filter((version) => version !== '' && !metadata.includes(version))
          .map((version) => `${rule.id} × ${pm}: ${version}`),
      );
    });
  });

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

describe('docs/version-matrix.md', () => {
  it('lists every live binding in each documented rule section', () => {
    expect.hasAssertions();
    const markdown = readFileSync(VERSION_MATRIX_DOC, 'utf8');
    expect(findMissingBindingRows(markdown)).toStrictEqual([]);
  });

  it('keeps binding version metadata represented in the matching row', () => {
    expect.hasAssertions();
    const markdown = readFileSync(VERSION_MATRIX_DOC, 'utf8');
    expect(findMissingVersionFacts(markdown)).toStrictEqual([]);
  });

  it('keeps confirmed available/default-safe facts in runtime metadata', () => {
    expect.hasAssertions();
    const markdown = readFileSync(VERSION_MATRIX_DOC, 'utf8');
    expect(findConfirmedFactsWithoutMetadata(markdown)).toStrictEqual([]);
  });
});
