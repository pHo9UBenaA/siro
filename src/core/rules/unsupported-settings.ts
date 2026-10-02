import { lt } from 'semver';
import type { PM } from '../contracts/pms.ts';
import type { RelPath } from '../contracts/paths.ts';
import { getByPath } from '../contracts/config-value.ts';
import { defineRule, type RuleBinding, type ViolationStatus } from '../contracts/rule.ts';
import { settingAvailability } from './setting-availability.ts';

const bindingFor = (pm: PM, includesFile: (file: string) => boolean): RuleBinding => {
  const settings = settingAvailability.filter(
    (setting) => setting.pm === pm && includesFile(setting.file.path),
  );
  return {
    check(ctx) {
      const version = ctx.pmVersion;
      if (version === undefined) return { state: 'na' };
      const unsupported = settings.filter(
        (setting) =>
          lt(version, setting.since) &&
          getByPath(ctx.readConfig(setting.file), setting.keyPath) !== undefined,
      );
      const unsupportedByFile = new Map<RelPath, typeof settings>();
      for (const setting of unsupported) {
        const fileSettings = unsupportedByFile.get(setting.file.path) ?? [];
        fileSettings.push(setting);
        unsupportedByFile.set(setting.file.path, fileSettings);
      }
      const violations = [...unsupportedByFile].map(([file, fileSettings]): ViolationStatus => {
        const requirements = fileSettings.map(
          (setting) => `${setting.keyPath.join('.')} (requires ${pm} >=${setting.since})`,
        );
        return {
          state: 'violation',
          file,
          message: `Target ${pm} ${version} predates support for ${file}: ${requirements.join('; ')}.`,
          remediation: {
            kind: 'manual',
            steps: [
              'Verify the PM version used by your install or publish command. If the declared target is accurate, upgrade the PM or use a security control supported by that target; removing a setting alone does not provide its protection.',
              ...fileSettings.map(
                (setting) => `${setting.file.path}#${setting.keyPath.join('.')}: ${setting.source}`,
              ),
            ],
          },
        };
      });
      const [first, ...rest] = violations;
      return first ? { state: 'violations', violations: [first, ...rest] } : { state: 'ok' };
    },
  };
};

export const createUnsupportedSettings = (includesFile: (file: string) => boolean) =>
  defineRule({
    id: 'unsupported-settings',
    title: 'Use settings available in the target PM version',
    description:
      'Report configured settings whose recorded introduction version is newer than the declared or explicit stable PM target. Reports each affected file separately, grouping its unsupported keys. Findings retain their evaluation directory. Only the coverage table below is checked. Unknown targets and unlisted settings are not evaluated for availability.',
    severity: 'error',
    docs: 'https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error',
    bindings: {
      npm: bindingFor('npm', includesFile),
      pnpm: bindingFor('pnpm', includesFile),
      yarn: bindingFor('yarn', includesFile),
      bun: bindingFor('bun', includesFile),
      deno: bindingFor('deno', includesFile),
    },
  });

export const unsupportedSettings = createUnsupportedSettings(() => true);
