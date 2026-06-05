import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
import { type VersionNote, renderVersionNoteMessage } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { bunfig } = CONFIG_FILES;
const versionNote: VersionNote = { configAvailableSince: 'bun 1.3.0' };

const bunScannerBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    const scanner = getByPath(config, ['install', 'security', 'scanner']);
    const EMPTY = 0;
    if (typeof scanner === 'string' && scanner.length > EMPTY) {
      return { state: 'ok' };
    }
    return {
      actual: scanner,
      message: renderVersionNoteMessage(
        'Configure `[install.security] scanner = "..."` in bunfig.toml (e.g. `@socketsecurity/bun-security-scanner`) to scan new packages on install.',
        versionNote,
      ),
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
};

export const bunSecurityScanner: Rule = {
  bindings: {
    bun: bunScannerBinding,
  },
  description:
    'Bun supports a Security Scanner API that intercepts new packages at install time (e.g. Socket Firewall).',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#preinstall-scanners',
  id: 'bun-security-scanner',
  severity: 'info',
  title: 'Enable a bun install-time security scanner',
};
