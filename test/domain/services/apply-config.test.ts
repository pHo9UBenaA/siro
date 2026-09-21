import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';
import { applyConfig } from '../../../src/domain/services/apply-config.ts';

it('preserves the supplied rule order without user configuration', () => {
  const result = applyConfig([provenance, pinExactVersions]);
  expect(result.rules.map((rule) => rule.id)).toEqual(['provenance', 'pin-exact-versions']);
  expect(result.severityOverrides.size).toBe(0);
});
