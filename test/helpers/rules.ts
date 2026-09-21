import { createMinimumReleaseAge } from '../../src/domain/rules/minimum-release-age.ts';

/** Existing integration examples can still control host time with fake timers. */
export const minimumReleaseAge = createMinimumReleaseAge({
  now: () => Date.now(),
  parse: (value) => Date.parse(value),
});
