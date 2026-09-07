import { lt } from 'semver';
import type { PM } from '../entities/pms.ts';
import { getByPath } from '../entities/config-value.ts';
import { defineRule, type RuleBinding } from '../entities/rule.ts';
import { settingAvailability } from '../setting-availability.ts';

const bindingFor = (pm: PM): RuleBinding => {
  const settings = settingAvailability.filter((setting) => setting.pm === pm);
  return {
    check(ctx) {
      const version = ctx.pmVersion;
      if (version === undefined) return { state: 'na' };
      const unsupported = settings.filter(
        (setting) =>
          lt(version, setting.since) &&
          getByPath(ctx.readConfig(setting.file), setting.keyPath) !== undefined,
      );
      const first = unsupported[0];
      if (!first) return { state: 'ok' };
      const requirements = unsupported.map(
        (setting) =>
          `${setting.file.path}#${setting.keyPath.join('.')} (requires ${pm} >=${setting.since})`,
      );
      return {
        state: 'violation',
        file: first.file.path,
        message: `Target ${pm} ${version} predates support for: ${requirements.join('; ')}.`,
        remediation: {
          kind: 'manual',
          steps: [
            'Verify the PM version used by your install or publish command. If the declared target is accurate, upgrade the PM or use a security control supported by that target; removing a setting alone does not provide its protection.',
            ...unsupported.map(
              (setting) => `${setting.file.path}#${setting.keyPath.join('.')}: ${setting.source}`,
            ),
          ],
        },
      };
    },
  };
};

export const unsupportedSettings = defineRule({
  id: 'unsupported-settings',
  title: 'Use settings available in the target PM version',
  description:
    'Report configured settings whose recorded introduction version is newer than the declared or explicit stable PM target. Groups all unsupported settings per manager; the finding points to the first affected file. Only the coverage table below is checked. Unknown targets and unlisted settings are not evaluated for availability.',
  severity: 'error',
  docs: 'https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error',
  bindings: {
    npm: bindingFor('npm'),
    pnpm: bindingFor('pnpm'),
    yarn: bindingFor('yarn'),
    bun: bindingFor('bun'),
  },
});
