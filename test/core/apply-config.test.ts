import { pinExactVersions } from '../../src/core/rules/pin-exact-versions.ts';
import { provenance } from '../../src/core/rules/provenance.ts';
import { applyConfig } from '../../src/core/apply-config.ts';

it('preserves the supplied rule order without user configuration', () => {
  const result = applyConfig([provenance, pinExactVersions]);
  expect(result.rules.map((rule) => rule.id)).toEqual(['provenance', 'pin-exact-versions']);
  expect(result.severityOverrides.size).toBe(0);
});
