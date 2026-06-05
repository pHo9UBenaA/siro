import type { AdvisoryRuleBinding, CheckStatus, Rule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { type ConfigReadValue, type ParsedConfig, getByPath } from '../entities/config-value.ts';

const { yarnrc } = CONFIG_FILES;

const isNonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const SUPPRESSION_KEYS = ['npmAuditIgnoreAdvisories', 'npmAuditExcludePackages'] as const;

const checkSuppression = (config: ParsedConfig): CheckStatus => {
  const present = SUPPRESSION_KEYS.filter((key) => isNonEmptyArray(getByPath(config, [key])));
  const [first] = present;
  if (typeof first === 'undefined') {
    return { state: 'ok' };
  }
  const actual: ConfigReadValue = getByPath(config, [first]);
  return {
    actual,
    message: `Review audit suppression in .yarnrc.yml (${present.join(', ')}). Broad glob patterns can silently hide future vulnerabilities.`,
    state: 'violation',
  };
};

const yarnBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    return checkSuppression(config);
  },
  docs: 'https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories',
  file: yarnrc,
  fix() {
    return [
      {
        file: yarnrc,
        message:
          'Review entries in `npmAuditIgnoreAdvisories` and `npmAuditExcludePackages` — remove stale suppressions and overly broad glob patterns.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
};

export const auditSuppression: Rule = {
  bindings: { yarn: yarnBinding },
  description:
    'Flag audit advisory suppressions that may silently hide future vulnerabilities via broad glob patterns.',
  docs: 'https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories',
  id: 'audit-suppression',
  severity: 'info',
  title: 'Review audit suppression entries',
};
