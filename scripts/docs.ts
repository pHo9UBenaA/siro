import { renderVersionNoteMessage } from '../src/core/render-version-note.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Rule } from '../src/core/contracts/rule.ts';
import { PMS } from '../src/core/contracts/pms.ts';
import { rules as defaultRules } from '../src/runtime.ts';
import { scopeOf } from '../src/core/rules/builtin-rules.ts';
import { settingAvailability } from '../src/core/rules/setting-availability.ts';

const COMPARISON_INTRO = `<!-- AUTO-GENERATED from the rule registry. Run \`pnpm gen:docs\` to update. -->
# Package manager comparison

Which security rules \`siro\` can check for each package manager.
Generic \`files-field\` and portable \`publish-access\` checks also run on discovered
manifests with unknown PMs, once per manifest. Other checks require local policy
targets; installation checks run only at explicit installation roots. This matrix
is not a claim of effective-policy inspection for every discovered package.
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

const renderAvailabilityCoverage = (): string => {
  const rows = settingAvailability.map(
    (setting) =>
      `| ${setting.pm} | \`${setting.file.path}\` | \`${setting.keyPath.join('.')}\` | ${setting.since} | [release history](${setting.source}) |`,
  );
  return `

### Checked introduction versions

Only the following setting/file pairs are checked. This is not whole-schema validation or a guarantee of support in all later versions. Deno coverage is limited to \`.npmrc#min-release-age\`; Aube has no availability entries in this release.

| PM | File | Setting | First stable version in this file | Source |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

For pnpm, strictDepBuilds was introduced in 10.3.0; the checked YAML location requires 10.6.0. A prerelease or range in packageManager leaves availability unknown. See [target versions](configuration.md#target-pm-versions) for explicit versions and precedence.`;
};

const renderRule = (rule: Rule): string => {
  const scopes = {
    installation: 'Explicit installation roots only (local settings).',
    manifest: 'Every discovered manifest, with PM-neutral checks once per manifest.',
    split:
      'Manifest entries per local manifest target; install-config entries only at explicit installation roots.',
    custom: 'cwd only.',
  };
  const parts = [
    `## \`${rule.id}\` — ${rule.severity}\n\n${rule.description}`,
    `\nInspection scope: ${scopes[scopeOf(rule.id)]}`,
  ];
  if (rule.projectTypes) parts.push(`\nApplies to: ${rule.projectTypes.join(', ')}.`);
  if (rule.id === 'provenance')
    parts.push(
      '\nFor npm, own package.json publishConfig.provenance overrides .npmrc, including false. Manifest-only children do not receive effective provenance checks.',
    );
  if (rule.docs) parts.push(`\nUpstream: <${rule.docs}>`);
  parts.push(renderBindingsBlock(rule));
  if (rule.id === 'unsupported-settings') parts.push(renderAvailabilityCoverage());
  return `${parts.join('')}\n`;
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

Each rule encodes one security intent. Generic publication checks do not need a PM;
installation checks and setting availability use local PM targets. See the
[comparison matrix](comparison.md) for which PMs each rule applies to.
A check may read files beyond its listed primary input. Your configuration and the
observed settings can change the severity shown below. Version notes describe PM
support; siro does not inspect installed binaries. See [policy sources](policy-sources.md)
for defaults, precedence and version limits.

| Severity | Meaning |
| --- | --- |
| \`error\` | Fails \`siro lint\` by default. |
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
