import type { ParsedConfig } from '../../src/domain/entities/config-value.ts';
import type { RepoContext } from '../../src/domain/ports/repo-context.ts';
import type { RuleBinding } from '../../src/domain/entities/rule.ts';

export const expectDocumentedDefaultDynamicInfo = (
  binding: RuleBinding | undefined,
  ctx: RepoContext,
): void => {
  if (!binding) {
    throw new TypeError('expected binding');
  }
  expect(binding.severity).toBeUndefined();
  const status = binding.check(ctx, {});
  expect(status.state, 'binding must be in-scope for this helper (no `na`)').toBe('violation');
  expect(status).toMatchObject({ severity: 'info', state: 'violation' });
};

interface ExpectMessageContainsOptions {
  readonly binding: RuleBinding | undefined;
  readonly ctx: RepoContext;
  readonly substrings: readonly string[];
  readonly config?: ParsedConfig;
}

export const expectMessageContains = (opts: ExpectMessageContainsOptions): void => {
  const { binding, ctx, substrings, config = {} } = opts;
  if (!binding) {
    throw new TypeError('expected binding');
  }
  const status = binding.check(ctx, config);
  expect(status.state).toBe('violation');
  if (status.state !== 'violation') {
    return;
  }
  for (const sub of substrings) {
    expect(status.message, `expected message to contain "${sub}"`).toContain(sub);
  }
};

interface ExpectMessageContainsAndAvoidsOptions {
  readonly binding: RuleBinding | undefined;
  readonly ctx: RepoContext;
  readonly options: {
    readonly contains: readonly string[];
    readonly notMatching: readonly RegExp[];
  };
  readonly config?: ParsedConfig;
}

const assertViolationMessage = (
  message: string | undefined,
  options: { readonly contains: readonly string[]; readonly notMatching: readonly RegExp[] },
): void => {
  for (const sub of options.contains) {
    expect(message, `expected message to contain "${sub}"`).toContain(sub);
  }
  for (const re of options.notMatching) {
    expect(message, `expected message NOT to match ${re}`).not.toMatch(re);
  }
};

export const expectMessageContainsAndAvoids = (
  opts: ExpectMessageContainsAndAvoidsOptions,
): void => {
  const { binding, ctx, options, config = {} } = opts;
  if (!binding) {
    throw new TypeError('expected binding');
  }
  const status = binding.check(ctx, config);
  expect(status.state).toBe('violation');
  if (status.state !== 'violation') {
    return;
  }
  assertViolationMessage(status.message, options);
};
