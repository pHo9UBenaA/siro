import type { Finding, PolicyTarget } from './contracts/lint-result.ts';
import type { Severity } from './contracts/pms.ts';
import { isCheckStatusShape, type Rule, type RuleBinding } from './contracts/rule.ts';
import { ConfigError } from './contracts/errors.ts';
import { assertSynchronous } from './contracts/synchronous.ts';
import type { RepositoryEvaluation } from './parse-config-file.ts';
import { decideSeverity } from './decide-severity.ts';
import { renderVersionNoteMessage } from './render-version-note.ts';
import { guardRemediationAvailability } from './rules/remediation-availability.ts';

/** One response boundary for generic and PM-specific checks. Selection stays with callers. */
export const evaluateBinding = (
  repository: RepositoryEvaluation,
  rule: Rule,
  binding: RuleBinding,
  overrides: ReadonlyMap<string, Severity> | undefined,
  target?: PolicyTarget,
): Finding[] => {
  const response: unknown = binding.check(
    { ...repository.ctx, readConfig: repository.parseConfig, pmVersion: target?.version },
    repository.parseConfig(binding.file),
  );
  assertSynchronous(response, `Rule '${rule.id}' check`);
  if (!isCheckStatusShape(response))
    throw new ConfigError(`Rule '${rule.id}' returned an invalid check result.`);
  if (response.state === 'ok' || response.state === 'na') return [];
  const statuses = response.state === 'violations' ? response.violations : [response];
  return statuses.map(
    (status): Finding => ({
      ruleId: rule.id,
      directory: '.',
      ...(target ? { pm: target.pm } : {}),
      severity: decideSeverity(status, binding, rule, overrides?.get(rule.id)),
      message: renderVersionNoteMessage(status.message, binding.versionNote),
      file: status.file ?? binding.file?.path,
      docs: binding.docs ?? rule.docs,
      actual: status.actual,
      expected: status.expected,
      remediation: target
        ? guardRemediationAvailability(target.pm, target.version, status.remediation)
        : status.remediation,
    }),
  );
};
