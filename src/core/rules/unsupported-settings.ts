import { lt } from 'semver';
import type { PM } from '../contracts/pms.ts';
import type { RelPath } from '../contracts/paths.ts';
import { getByPath } from '../contracts/config-value.ts';
import { defineRule, type RuleBinding, type ViolationStatus } from '../contracts/rule.ts';
import { settingAvailabilityByPM } from './setting-availability.ts';

const bindingFor = (pm: PM, includesFile: (file: string) => boolean): RuleBinding => {
  const settings = settingAvailabilityByPM[pm].filter((setting) => includesFile(setting.file.path));
  return {
    check(ctx) {
      const version = ctx.pmVersion;
      if (version === undefined) return { state: 'na' };
      const unsupportedByFile = new Map<RelPath, typeof settings>();
      for (const setting of settings) {
        if (
          !lt(version, setting.since) ||
          getByPath(ctx.readConfig(setting.file), setting.keyPath) === undefined
        )
          continue;
        const fileSettings = unsupportedByFile.get(setting.file.path) ?? [];
        fileSettings.push(setting);
        unsupportedByFile.set(setting.file.path, fileSettings);
      }
      const violations = Array.from(unsupportedByFile, ([file, fileSettings]): ViolationStatus => {
        const requirements: string[] = [];
        const steps: [string, ...string[]] = [
          'Verify the PM version used by your install or publish command. If the declared target is accurate, upgrade the PM or use a security control supported by that target; removing a setting alone does not provide its protection.',
        ];
        for (const setting of fileSettings) {
          requirements.push(`${setting.keyPath.join('.')} (requires ${pm} >=${setting.since})`);
          steps.push(`${setting.file.path}#${setting.keyPath.join('.')}: ${setting.source}`);
        }
        return {
          state: 'violation',
          file,
          message: `Target ${pm} ${version} predates support for ${file}: ${requirements.join('; ')}.`,
          remediation: { kind: 'manual', steps },
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
      'Report configured settings introduced after the declared or explicit stable PM target version. Only the coverage table below is checked; unknown versions and unlisted settings are not assessed.',
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
