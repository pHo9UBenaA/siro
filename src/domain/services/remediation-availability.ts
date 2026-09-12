import { lt } from 'semver';
import type { PM } from '../entities/pms.ts';
import type { ConfigFileRef, Remediation } from '../entities/rule.ts';
import type { KeyPath } from '../entities/config-value.ts';
import { settingAvailability } from '../setting-availability.ts';

type SettingTarget = { readonly file: ConfigFileRef; readonly keyPath: KeyPath };

const sameSetting = (setting: SettingTarget, target: SettingTarget): boolean =>
  target.file.path === setting.file.path &&
  target.file.kind === setting.file.kind &&
  target.keyPath.length === setting.keyPath.length &&
  target.keyPath.every((key, index) => key === setting.keyPath[index]);

/** Undefined means the target version or the setting's introduction is unknown. */
export const settingSupportedByTarget = (
  pm: PM,
  version: string | undefined,
  target: SettingTarget,
): boolean | undefined => {
  if (version === undefined) return undefined;
  const availability = settingAvailability.find(
    (setting) => setting.pm === pm && sameSetting(setting, target),
  );
  return availability === undefined ? undefined : !lt(version, availability.since);
};

/** Keep a proposal atomic and make known version prerequisites explicit. */
export const guardRemediationAvailability = (
  pm: PM,
  version: string | undefined,
  remediation: Remediation | undefined,
  targets: readonly SettingTarget[] = remediation?.kind === 'automatic'
    ? remediation.operations
    : [],
): Remediation | undefined => {
  if (version === undefined || remediation === undefined) return remediation;
  const unsupported = settingAvailability.filter(
    (setting) =>
      setting.pm === pm &&
      lt(version, setting.since) &&
      targets.some((target) => sameSetting(setting, target)),
  );
  if (unsupported.length === 0) return remediation;
  const requirements = unsupported.map(
    (setting) =>
      `${setting.file.path}#${setting.keyPath.join('.')} requires ${pm} >=${setting.since}`,
  );
  return {
    kind: 'manual',
    steps: [
      `Target ${pm} ${version} does not support this proposal: ${requirements.join('; ')}. Verify and upgrade the target before applying the steps below, or choose a supported security control. Removing a setting alone does not provide its protection.`,
      ...(remediation.kind === 'manual'
        ? remediation.steps
        : remediation.operations.map(
            (operation) =>
              `After upgrading, set ${operation.file.path}#${operation.keyPath.join('.')} to ${JSON.stringify(operation.value)}.`,
          )),
    ],
  };
};
