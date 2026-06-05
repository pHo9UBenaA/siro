import { type BindingVisit, evaluateBindings } from '../domain/services/evaluate-bindings.ts';
import type { Finding, LintResult } from '../domain/entities/lint-result.ts';
import type { FixOp, Rule } from '../domain/entities/rule.ts';
import type { PM, Severity } from '../domain/entities/pms.ts';
import type { CodecFor } from '../domain/ports/config-codec.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import { createConfigParser } from '../domain/services/parse-config-file.ts';
import { decideSeverity } from '../domain/services/decide-severity.ts';

export interface RunLintOptions {
  readonly ctx: RepoContext;
  readonly pms: readonly PM[];
  readonly ruleSet: readonly Rule[];
  readonly codecFor: CodecFor;
}

const EMPTY = 0;

const resolveManualSteps = (raw: readonly string[] | undefined): readonly string[] | undefined => {
  if (typeof raw !== 'undefined' && raw.length > EMPTY) {
    return raw;
  }
  return void 0;
};

const buildFinding = (visit: BindingVisit, ctx: RepoContext): Finding => {
  const { rule, pm, binding, status } = visit;
  // User `rules` overrides are folded in by `applyConfig` upstream — by
  // the time we reach decideSeverity, the only live sources are the
  // dynamic status severity, the per-PM binding severity, and the
  // rule-wide default.
  const severity = decideSeverity(status, binding, rule);
  const manualSteps = resolveManualSteps(status.manualSteps);
  let filePath: string | undefined = void 0;
  if (binding.file.kind !== 'fileGlob') {
    filePath = binding.file.path;
  }

  // A violation carrying manualSteps cannot be resolved by writing its
  // setKey ops (the user state that produced the steps would defeat
  // them), so `fix` is suppressed and the steps carry the remediation.
  let fix: readonly FixOp[] = [];
  if (typeof manualSteps === 'undefined') {
    fix = binding.fix(ctx);
  }
  return {
    actual: status.actual,
    docs: binding.docs ?? rule.docs,
    expected: status.expected,
    file: filePath,
    fix,
    fixable: binding.fixKind === 'auto' && typeof manualSteps === 'undefined',
    manualSteps,
    message: status.message,
    pm,
    ruleId: rule.id,
    severity,
  };
};

/** Evaluate every rule binding for the given PMs and collect violations. */
export const runLint = (opts: RunLintOptions): LintResult => {
  const { ctx, pms, ruleSet, codecFor } = opts;
  const findings: Finding[] = [];
  const summary: Record<Severity, number> = { error: 0, info: 0, warn: 0 };
  const parseConfig = createConfigParser(codecFor);

  evaluateBindings({
    ctx,
    onViolation: (visit) => {
      const finding = buildFinding(visit, ctx);
      findings.push(finding);
      summary[finding.severity] += 1;
    },
    parseConfig,
    pms,
    ruleSet,
  });

  return { findings, summary };
};
