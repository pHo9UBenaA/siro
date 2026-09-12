import { guardRemediationAvailability } from '../services/remediation-availability.ts';
import { isNonBlankString } from './config-predicates.ts';
import { type RuleBinding, defineRule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { bunfig } = CONFIG_FILES;

const bunScannerBinding: RuleBinding = {
  check(ctx, config) {
    const scanner = getByPath(config, ['install', 'security', 'scanner']);
    if (isNonBlankString(scanner)) {
      return { state: 'ok' };
    }
    return {
      remediation: guardRemediationAvailability(
        'bun',
        ctx.pmVersion,
        {
          kind: 'manual',
          steps: [
            'Add `[install.security] scanner = "@socketsecurity/bun-security-scanner"` (or another bun-compatible scanner) to bunfig.toml.',
          ],
        },
        [{ file: bunfig, keyPath: ['install', 'security', 'scanner'] }],
      ),
      actual: scanner,
      message:
        'Configure `[install.security] scanner = "..."` in bunfig.toml (e.g. `@socketsecurity/bun-security-scanner`) to scan new packages on install.',
      state: 'violation',
    };
  },
  docs: 'https://bun.com/docs/pm/security-scanner-api',
  file: bunfig,

  versionNote: { configAvailableSince: 'bun 1.2.21' },
};

export const bunSecurityScanner = defineRule({
  bindings: {
    bun: bunScannerBinding,
  },
  description:
    'Bun supports a Security Scanner API that intercepts new packages at install time (e.g. Socket Firewall).',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#preinstall-scanners',
  id: 'bun-security-scanner',
  severity: 'info',
  title: 'Enable a bun install-time security scanner',
});
