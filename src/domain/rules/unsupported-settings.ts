import { lt } from 'semver';
import type { PM } from '../entities/pms.ts';
import { getByPath } from '../entities/config-value.ts';
import { defineRule, type RuleBinding, type ViolationStatus } from '../entities/rule.ts';
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
      const files = [...new Set(unsupported.map((setting) => setting.file.path))];
      const violations = files.map((file): ViolationStatus => {
        const fileSettings = unsupported.filter((setting) => setting.file.path === file);
        const requirements = fileSettings.map(
          (setting) => `${setting.keyPath.join('.')} (requires ${pm} >=${setting.since})`,
        );
        return {
          state: 'violation' as const,
          file,
          message: `Target ${pm} ${version} predates support for ${file}: ${requirements.join('; ')}.`,
          remediation: {
            kind: 'manual' as const,
            steps: [
              'Verify the PM version used by your install or publish command. If the declared target is accurate, upgrade the PM or use a security control supported by that target; removing a setting alone does not provide its protection.',
              ...fileSettings.map(
                (setting) => `${setting.file.path}#${setting.keyPath.join('.')}: ${setting.source}`,
              ),
            ] as [string, ...string[]],
          },
        };
      });
      const [first, ...rest] = violations;
      return first ? { state: 'violations', violations: [first, ...rest] } : { state: 'ok' };
    },
  };
};

export const unsupportedSettings = defineRule({
  id: 'unsupported-settings',
  title: 'Use settings available in the target PM version',
  description:
    'Report configured settings whose recorded introduction version is newer than the declared or explicit stable PM target. Reports each affected file separately, grouping its unsupported keys. Workspace findings retain their member directory. Only the coverage table below is checked. Unknown targets and unlisted settings are not evaluated for availability.',
  severity: 'error',
  docs: 'https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error',
  bindings: {
    npm: bindingFor('npm'),
    pnpm: bindingFor('pnpm'),
    yarn: bindingFor('yarn'),
    bun: bindingFor('bun'),
  },
});
