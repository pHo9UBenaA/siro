import { makeCtx } from '../../helpers/ctx.ts';
import { minimumReleaseAge } from '../../../src/domain/rules/minimum-release-age.ts';
import { approvedGitRepos } from '../../../src/domain/rules/approved-git-repos.ts';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { bunSecurityScanner } from '../../../src/domain/rules/bun-security-scanner.ts';

const ctx = makeCtx();

it.each(['aube', 'bun', 'deno', 'pnpm', 'yarn'] as const)(
  '%s does not treat an infinite release age as configured protection',
  (pm) => {
    const configs = {
      aube: { minimumReleaseAge: Infinity },
      bun: { install: { minimumReleaseAge: Infinity } },
      deno: { minimumDependencyAge: Infinity },
      pnpm: { minimumReleaseAge: Infinity },
      yarn: { npmMinimalAgeGate: Infinity },
    };
    expect(minimumReleaseAge.bindings[pm]?.check(ctx, configs[pm]).state).toBe('violation');
  },
);

it.each([{ age: { age: 'P3D' } }, { age: null }, { exclude: [false] }, new Date()])(
  'does not accept a malformed Deno age object: %j',
  (value) => {
    expect(minimumReleaseAge.bindings.deno?.check(ctx, { minimumDependencyAge: value }).state).toBe(
      'violation',
    );
  },
);

it.each([{ value: [false] }, { value: [''] }, { value: ['   '] }, { value: Array(1) }])(
  'does not accept malformed allowlists: %j',
  ({ value }) => {
    expect(
      approvedGitRepos.bindings.yarn?.check(ctx, { approvedGitRepositories: value }).state,
    ).toBe('violation');
    expect(
      filesField.bindings.deno?.check(ctx, { name: '@scope/pkg', publish: { include: value } })
        .state,
    ).toBe('violation');
  },
);

it('does not treat whitespace as a configured Bun scanner', () => {
  expect(
    bunSecurityScanner.bindings.bun?.check(ctx, { install: { security: { scanner: '  ' } } }).state,
  ).toBe('violation');
});
