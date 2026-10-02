import { type RuleBinding, defineRule } from '../contracts/rule.ts';
import { CONFIG_FILES } from '../config-files.ts';
import { getByPath } from '../contracts/config-value.ts';

const { yarnrc } = CONFIG_FILES;

const isNonEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const SUPPRESSION_KEYS = ['npmAuditIgnoreAdvisories', 'npmAuditExcludePackages'] as const;

const yarnBinding: RuleBinding = {
  check(_ctx, config) {
    const suppressedKeys = SUPPRESSION_KEYS.filter((key) =>
      isNonEmptyArray(getByPath(config, [key])),
    );
    const [first] = suppressedKeys;
    if (first === undefined) return { state: 'ok' };
    return {
      actual: getByPath(config, [first]),
      message: `Review audit suppression in .yarnrc.yml (${suppressedKeys.join(', ')}). Broad glob patterns can silently hide future vulnerabilities.`,
      state: 'violation',
      remediation: {
        kind: 'manual',
        steps: [
          'Review entries in `npmAuditIgnoreAdvisories` and `npmAuditExcludePackages` — remove stale suppressions and overly broad glob patterns.',
        ],
      },
    };
  },
  docs: 'https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories',
  file: yarnrc,
};

export const auditSuppression = defineRule({
  bindings: { yarn: yarnBinding },
  description:
    'Flag audit advisory suppressions that may silently hide future vulnerabilities via broad glob patterns.',
  docs: 'https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories',
  id: 'audit-suppression',
  severity: 'info',
  title: 'Review audit suppression entries',
});
