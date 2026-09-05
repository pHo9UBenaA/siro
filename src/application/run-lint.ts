import { CONFIG_FILES } from '../domain/entities/config-files.ts';
import type { Finding, LintResult } from '../domain/entities/lint-result.ts';
import type { PM, Severity } from '../domain/entities/pms.ts';
import type { ProjectType } from '../domain/entities/project-type.ts';
import { type Rule, isCheckStatusShape } from '../domain/entities/rule.ts';
import type { CodecFor } from '../domain/ports/config-codec.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import { decideSeverity } from '../domain/services/decide-severity.ts';
import { createConfigParser, type ConfigParser } from '../domain/services/parse-config-file.ts';
import {
  resolveDenoProjectType,
  resolvePackageJsonProjectType,
} from '../domain/services/project-type.ts';
import { renderVersionNoteMessage } from '../domain/services/render-version-note.ts';
import { ConfigError } from '../shared/errors.ts';

export interface RunLintOptions {
  readonly ctx: RepoContext;
  readonly pms: readonly PM[];
  readonly ruleSet: readonly Rule[];
  readonly severityOverrides?: ReadonlyMap<string, Severity>;
  readonly codecFor: CodecFor;
}

const resolveBindingProjectType = (
  ctx: RepoContext,
  pm: PM,
  parseConfig: ConfigParser,
): ProjectType => {
  if (ctx.projectType !== undefined) {
    return ctx.projectType;
  }
  if (pm === 'deno') {
    return resolveDenoProjectType(ctx, parseConfig(CONFIG_FILES.denoJson));
  }
  return resolvePackageJsonProjectType(ctx);
};

/** Evaluate every applicable rule binding and collect violations. */
export const runLint = (opts: RunLintOptions): LintResult => {
  const { ctx, pms, ruleSet, severityOverrides, codecFor } = opts;
  const findings: Finding[] = [];
  const summary: Record<Severity, number> = { error: 0, info: 0, warn: 0 };
  const parseConfig = createConfigParser(codecFor, ctx);

  for (const rule of ruleSet) {
    for (const pm of pms) {
      const binding = rule.bindings[pm];
      if (
        !binding ||
        (rule.projectTypes &&
          !rule.projectTypes.includes(resolveBindingProjectType(ctx, pm, parseConfig)))
      ) {
        continue;
      }

      const status: unknown = binding.check(ctx, parseConfig(binding.file));
      if (!isCheckStatusShape(status)) {
        throw new ConfigError(`Rule '${rule.id}' returned an invalid check result.`);
      }
      if (status.state !== 'violation') {
        continue;
      }

      const finding: Finding = {
        ruleId: rule.id,
        pm,
        severity: decideSeverity(status, binding, rule, severityOverrides?.get(rule.id)),
        message: renderVersionNoteMessage(status.message, binding.versionNote),
        file: binding.file?.path,
        docs: binding.docs ?? rule.docs,
        actual: status.actual,
        expected: status.expected,
        remediation: status.remediation,
      };
      findings.push(finding);
      summary[finding.severity] += 1;
    }
  }

  return { findings, summary };
};
