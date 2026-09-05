import { CONFIG_FILES } from '../domain/entities/config-files.ts';
import type { Finding, LintResult } from '../domain/entities/lint-result.ts';
import type { PM, Severity } from '../domain/entities/pms.ts';
import type { ProjectType } from '../domain/entities/project-type.ts';
import {
  type CheckStatus,
  type FixOp,
  type Rule,
  type RuleBinding,
  isCheckStatusShape,
  isFixResultShape,
} from '../domain/entities/rule.ts';
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

type Violation = Extract<CheckStatus, { state: 'violation' }>;

const resolveBindingProjectType = (
  ctx: RepoContext,
  pm: PM,
  parseConfig: ConfigParser,
): ProjectType => {
  if (ctx.projectType !== undefined) {
    return ctx.projectType;
  }
  if (pm === 'deno') {
    return resolveDenoProjectType(ctx, parseConfig(ctx, CONFIG_FILES.denoJson));
  }
  return resolvePackageJsonProjectType(ctx);
};

const appliesToProject = (
  rule: Rule,
  ctx: RepoContext,
  pm: PM,
  parseConfig: ConfigParser,
): boolean =>
  rule.projectTypes === undefined ||
  rule.projectTypes.includes(resolveBindingProjectType(ctx, pm, parseConfig));

const runFix = (rule: Rule, binding: RuleBinding, ctx: RepoContext): readonly FixOp[] => {
  const fix: unknown = binding.fix(ctx);
  if (!isFixResultShape(fix, binding.fixKind)) {
    throw new ConfigError(`Rule '${rule.id}' returned invalid fix operations.`);
  }
  return fix;
};

const checkBinding = (
  rule: Rule,
  binding: RuleBinding,
  ctx: RepoContext,
  parseConfig: ConfigParser,
): CheckStatus => {
  const status: unknown = binding.check(ctx, parseConfig(ctx, binding.file));
  if (!isCheckStatusShape(status)) {
    throw new ConfigError(`Rule '${rule.id}' returned an invalid check result.`);
  }
  return status;
};

const resolveManualSteps = (raw: readonly string[] | undefined): readonly string[] | undefined =>
  raw && raw.length > 0 ? raw : undefined;

const buildFinding = (
  rule: Rule,
  pm: PM,
  binding: RuleBinding,
  status: Violation,
  ctx: RepoContext,
  userOverride?: Severity,
): Finding => {
  const severity = decideSeverity(status, binding, rule, userOverride);
  const manualSteps = resolveManualSteps(status.manualSteps);
  const file = binding.file.kind === 'fileGlob' ? undefined : binding.file.path;
  const fix: readonly FixOp[] = manualSteps ? [] : runFix(rule, binding, ctx);

  return {
    actual: status.actual,
    docs: binding.docs ?? rule.docs,
    expected: status.expected,
    file,
    fix,
    fixable: binding.fixKind === 'auto' && !manualSteps && fix.length > 0,
    manualSteps,
    message: renderVersionNoteMessage(status.message, binding.versionNote),
    pm,
    ruleId: rule.id,
    severity,
  };
};

/** Evaluate every applicable rule binding and collect violations. */
export const runLint = (opts: RunLintOptions): LintResult => {
  const { ctx, pms, ruleSet, severityOverrides, codecFor } = opts;
  const findings: Finding[] = [];
  const summary: Record<Severity, number> = { error: 0, info: 0, warn: 0 };
  const parseConfig = createConfigParser(codecFor);

  for (const rule of ruleSet) {
    for (const pm of pms) {
      const binding = rule.bindings[pm];
      if (!binding || !appliesToProject(rule, ctx, pm, parseConfig)) {
        continue;
      }

      const status = checkBinding(rule, binding, ctx, parseConfig);
      if (status.state !== 'violation') {
        continue;
      }

      const finding = buildFinding(rule, pm, binding, status, ctx, severityOverrides?.get(rule.id));
      findings.push(finding);
      summary[finding.severity] += 1;
    }
  }

  return { findings, summary };
};
