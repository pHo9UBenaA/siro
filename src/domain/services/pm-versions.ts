import { parse } from 'semver';
import { isPM, type PM } from '../entities/pms.ts';

/** Release history establishes stable versions, not ranges or prerelease builds. */
export const isStableVersion = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d/u.test(value) || value.trim() !== value) return false;
  const version = parse(value);
  return version !== null && version.prerelease.length === 0;
};

/** Keep name-only detection independent from whether the declaration pins a version. */
export const declaredPMVersion = (declaration: string | undefined): Partial<Record<PM, string>> => {
  const [pm, version, ...extra] = declaration?.trim().split('@') ?? [];
  return pm && isPM(pm) && isStableVersion(version) && extra.length === 0 ? { [pm]: version } : {};
};
