import { renderVersionNoteMessage } from '../src/domain/services/render-version-note.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Rule } from '../src/domain/entities/rule.ts';
import { PMS } from '../src/domain/entities/pms.ts';
import { rules as defaultRules } from '../src/domain/builtin-rules.ts';

const COMPARISON_INTRO = `<!-- AUTO-GENERATED from the rule registry. Run \`pnpm gen:docs\` to update. -->
# Package manager comparison

Which security rules \`siro\` can check for each package manager.
**✅** = a check is implemented · **—** = no check is implemented.
An absent check says nothing about the manager's capabilities. See the
[rule reference](rules.md) for primary inputs, severity overrides, and version notes.
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

const renderBindingsBlock = (rule: Rule): string => {
  const rows = PMS.flatMap((pm) => {
    const binding = rule.bindings[pm];
    if (!binding) return [];
    const target = binding.file ? `\`${binding.file.path}\`` : 'Repository';
    const notes = renderVersionNoteMessage('', binding.versionNote).trim() || '—';
    return [
      `| \`${pm}\` | ${target} | ${binding.severity ?? rule.severity} | ${notes.replaceAll('|', '&#124;')} | ${resolveLink(binding.docs, rule.docs)} |`,
    ];
  });
  return rows.length
    ? `\n\n| PM | Primary input | Default severity | Version notes | Reference |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}`
    : '';
};

const renderRule = (rule: Rule): string => {
  const header = `## \`${rule.id}\` — ${rule.severity}`;
  const { description } = rule;
  let overview = '';
  if (rule.docs) {
    overview = `\nUpstream: <${rule.docs}>`;
  }
  const scope = rule.projectTypes ? `\nApplies to: ${rule.projectTypes.join(', ')}.` : '';
  return `${header}\n\n${description}${scope}${overview}${renderBindingsBlock(rule)}\n`;
};

export const renderComparison = (rules: readonly Rule[] = defaultRules): string => {
  const header = `| Rule | Severity | ${PMS.join(' | ')} |`;
  const separator = `| --- | --- | ${PMS.map(() => ':---:').join(' | ')} |`;
  const rows = rules.map((rule) => {
    const cells = PMS.map((pm) => {
      if (rule.bindings[pm]) {
        return '✅';
      }
      return '—';
    });
    return `| \`${rule.id}\` | ${rule.severity} | ${cells.join(' | ')} |`;
  });
  return `${[COMPARISON_INTRO, header, separator, ...rows].join('\n')}\n`;
};

const RULES_INTRO = `<!-- AUTO-GENERATED from the rule registry. Run \`pnpm gen:docs\` to update. -->
# Rule reference

Each rule encodes one security intent and maps it per package manager. See the
[comparison matrix](comparison.md) for which PMs each rule applies to.
Bindings may read additional files through the rule context. Result-specific severity
and user overrides can change the default shown below. Version notes describe policy;
siro does not inspect the installed package-manager version. See [policy sources](policy-sources.md).

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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check') || args.length > 1) {
    throw new Error('Usage: node scripts/docs.ts [--check]');
  }
  for (const [file, render] of [
    ['comparison.md', renderComparison],
    ['rules.md', renderRulesDoc],
  ] as const) {
    const destination = new URL(`../docs/${file}`, import.meta.url);
    const content = render();
    if (args.includes('--check')) {
      if (readFileSync(destination, 'utf8') !== content) {
        throw new Error(`${file} is out of date; run pnpm gen:docs`);
      }
    } else {
      writeFileSync(destination, content);
    }
  }
}
