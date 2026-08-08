import { type AdvisoryRuleBinding, defineRule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { bunfig } = CONFIG_FILES;
const bunScannerBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    const scanner = getByPath(config, ['install', 'security', 'scanner']);
    if (typeof scanner === 'string' && scanner.length > 0) {
      return { state: 'ok' };
    }
    return {
      actual: scanner,
      message:
        'Configure `[install.security] scanner = "..."` in bunfig.toml (e.g. `@socketsecurity/bun-security-scanner`) to scan new packages on install.',
      state: 'violation',
    };
  },
  docs: 'https://bun.com/docs/pm/security-scanner-api',
  file: bunfig,
  fix() {
    return [
      {
        file: bunfig,
        message:
          'Add `[install.security] scanner = "@socketsecurity/bun-security-scanner"` (or another bun-compatible scanner) to bunfig.toml.',
        op: 'note',
      },
    ];
  },
  fixKind: 'advisory',
  versionNote: { configAvailableSince: 'bun 1.3.0' },
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
