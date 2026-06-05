import type { ConfigFileRef, Rule } from '../../../src/domain/entities/rule.ts';
import { type PM, PMS } from '../../../src/domain/entities/pms.ts';
import { rules as defaultRules } from '../../../src/domain/builtin-rules.ts';

const PM_ORDER = PMS;

const COMPARISON_INTRO = `<!-- AUTO-GENERATED from the rule registry. Run \`pnpm gen:comparison\` to update. -->
# Package manager comparison

Which security rules \`siro\` can check for each package manager.
**✅** = supported · **—** = N/A (the manager has no equivalent setting **or** siro
does not yet bind it; see the rule's "Coverage notes" comment in \`src/domain/rules/\` for the reason).
`;

const resolveLink = (bindingDocs: string | undefined, ruleDocs: string | undefined): string => {
  if (bindingDocs) {
    return `[official docs](${bindingDocs})`;
  }
  if (ruleDocs) {
    return `[upstream guide](${ruleDocs})`;
  }
  return '—';
};

interface RenderBindingRowOptions {
  readonly pm: PM;
  readonly file: ConfigFileRef;
  readonly bindingDocs: string | undefined;
  readonly ruleDocs: string | undefined;
}

const renderBindingRow = (opts: RenderBindingRowOptions): string => {
  const target = `\`${opts.file.path}\``;
  // Prefer the PM-native anchor. When upstream has no anchor yet, link the
  // rule-level guide as a fallback — keeps `—` reserved for "no binding".
  const link = resolveLink(opts.bindingDocs, opts.ruleDocs);
  return `| \`${opts.pm}\` | ${target} | ${link} |`;
};

const renderBindingsBlock = (rule: Rule): string => {
  const bindings = PMS.flatMap((pm) => {
    const binding = rule.bindings[pm];
    if (typeof binding === 'undefined') {
      return [];
    }
    return [
      renderBindingRow({ bindingDocs: binding.docs, file: binding.file, pm, ruleDocs: rule.docs }),
    ];
  });
  const EMPTY = 0;
  if (bindings.length > EMPTY) {
    return `\n\n| PM | Target | Reference |\n| --- | --- | --- |\n${bindings.join('\n')}`;
  }
  return '';
};

const renderRule = (rule: Rule): string => {
  const header = `## \`${rule.id}\` — ${rule.severity}`;
  const { description } = rule;
  let overview = '';
  if (rule.docs) {
    overview = `\nUpstream: <${rule.docs}>`;
  }
  return `${header}\n\n${description}${overview}${renderBindingsBlock(rule)}\n`;
};

/**
 * Render the rule × package-manager support matrix as Markdown, derived from
 * the rule registry so the table can never drift from the actual bindings.
 *
 * Output order follows the curated insertion order of `rules` in
 * `src/domain/builtin-rules.ts` (not sorted by id); the doc-generator tests
 * pin determinism by id-uniqueness and byte-equality across reruns.
 */
export const renderComparison = (rules: readonly Rule[] = defaultRules): string => {
  const header = `| Rule | Severity | ${PM_ORDER.join(' | ')} |`;
  const separator = `| --- | --- | ${PM_ORDER.map(() => ':---:').join(' | ')} |`;
  const rows = rules.map((rule) => {
    const cells = PM_ORDER.map((pm) => {
      if (rule.bindings[pm]) {
        return '✅';
      }
      return '—';
    });
    return `| \`${rule.id}\` | ${rule.severity} | ${cells.join(' | ')} |`;
  });
  return `${[COMPARISON_INTRO, header, separator, ...rows].join('\n')}\n`;
};

const RULES_INTRO = `<!-- AUTO-GENERATED from the rule registry. Run \`pnpm gen:rules\` to update. -->
# Rule reference

Each rule encodes one security intent and maps it per package manager. See the
[comparison matrix](comparison.md) for which PMs each rule applies to.

| Severity | Meaning |
| --- | --- |
| \`error\` | High-impact supply-chain risk. Fails \`siro lint\` by default. |
| \`warn\` | Strongly recommended hardening. Fails with \`--severity warn\`. |
| \`info\` | Good hygiene; advisory. |
`;

/** Render docs/rules.md from the rule registry. */
export const renderRulesDoc = (rules: readonly Rule[] = defaultRules): string => {
  const sections = rules.map((rule) => renderRule(rule));
  return `${[RULES_INTRO, ...sections].join('\n')}\n`;
};
