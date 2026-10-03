import assert from 'node:assert/strict';
import type { CheckStatus, Rule, RuleBinding } from '../../src/core/contracts/rule.ts';
import type { PM } from '../../src/core/contracts/pms.ts';
import { createMinimumReleaseAge } from '../../src/core/rules/minimum-release-age.ts';

export const bindingForTest = (rule: Rule, pm: PM): RuleBinding => {
  const binding = rule.bindings[pm];
  assert(binding, `Expected ${rule.id} binding for ${pm}`);
  return binding;
};

/** Narrow the response while showing the complete actual result on failure. */
export function assertCheckState<State extends CheckStatus['state']>(
  status: CheckStatus,
  state: State,
): asserts status is Extract<CheckStatus, { state: State }> {
  expect(status).toMatchObject({ state });
}

/** Stable clock for rule units; runtime/adapter tests exercise host time separately. */
export const minimumReleaseAge = createMinimumReleaseAge({
  now: () => Date.parse('2026-09-06T12:00:00.000Z'),
  parse: (value) => Date.parse(value),
});
