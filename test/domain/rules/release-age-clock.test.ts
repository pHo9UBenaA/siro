import { createMinimumReleaseAge } from '../../../src/domain/rules/minimum-release-age.ts';
import { makeCtx } from '../../helpers/ctx.ts';

it.each([
  ['npm', { before: '2030-01-01T00:00:00.000Z' }],
  ['deno', { minimumDependencyAge: '2030-01-01T00:00:00.000Z' }],
] as const)(
  'evaluates %s cutoffs against its supplied clock without changing global time',
  (pm, config) => {
    let now = Date.parse('2030-01-01T00:00:00.000Z');
    const rule = createMinimumReleaseAge({ now: () => now, parse: Date.parse });
    const binding = rule.bindings[pm];
    expect(binding?.check(makeCtx(), config).state).toBe('violation');
    now += 1;
    expect(binding?.check(makeCtx(), config).state).toBe('ok');
    const other = createMinimumReleaseAge({ now: () => now - 1, parse: Date.parse });
    expect(other.bindings[pm]?.check(makeCtx(), config).state).toBe('violation');
  },
);

it('delegates offsetless before dates to the supplied parser instead of the process timezone', () => {
  const parse = vi.fn<(value: string) => number>(() => 99);
  const rule = createMinimumReleaseAge({ now: () => 100, parse });
  expect(rule.bindings.npm?.check(makeCtx(), { before: '2030-01-01T00:00:00' }).state).toBe('ok');
  expect(parse).toHaveBeenCalledWith('2030-01-01T00:00:00');
  parse.mockReturnValue(100);
  expect(rule.bindings.npm?.check(makeCtx(), { before: '2030-01-01T00:00:00' }).state).toBe(
    'violation',
  );
});
