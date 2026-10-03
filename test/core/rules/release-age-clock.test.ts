import { createMinimumReleaseAge } from '../../../src/core/rules/minimum-release-age.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { bindingForTest } from '../../helpers/rules.ts';

it.each([
  ['npm', { before: '2030-01-01T00:00:00.000Z' }],
  ['deno', { minimumDependencyAge: '2030-01-01T00:00:00.000Z' }],
] as const)(
  'evaluates %s cutoffs against its supplied clock without changing global time',
  (pm, config) => {
    const cutoffMs = Date.parse('2030-01-01T00:00:00.000Z');
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(cutoffMs)
      .mockReturnValue(cutoffMs + 1);
    const rule = createMinimumReleaseAge({ now, parse: Date.parse });
    const binding = bindingForTest(rule, pm);
    expect(binding.check(makeCtx(), config).state).toBe('violation');
    expect(binding.check(makeCtx(), config).state).toBe('ok');
    const other = createMinimumReleaseAge({ now: () => cutoffMs, parse: Date.parse });
    expect(bindingForTest(other, pm).check(makeCtx(), config).state).toBe('violation');
  },
);

it('delegates offsetless before dates to the supplied parser instead of the process timezone', () => {
  const parse = vi.fn<(value: string) => number>(() => 99);
  const rule = createMinimumReleaseAge({ now: () => 100, parse });
  expect(
    bindingForTest(rule, 'npm').check(makeCtx(), { before: '2030-01-01T00:00:00' }).state,
  ).toBe('ok');
  expect(parse).toHaveBeenCalledWith('2030-01-01T00:00:00');
  parse.mockReturnValue(100);
  expect(
    bindingForTest(rule, 'npm').check(makeCtx(), { before: '2030-01-01T00:00:00' }).state,
  ).toBe('violation');
});
