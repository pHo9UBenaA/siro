import { bindingForTest } from '../../helpers/rules.ts';
import type { RuleContext } from '../../../src/core/contracts/repo-context.ts';
import { filesField } from '../../../src/core/rules/files-field.ts';
import type { PackageJson } from '../../../src/core/contracts/package-json.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { manualSteps } from '../../helpers/remediation.ts';

const ctxWith = (packageJson?: PackageJson): RuleContext => makeCtx({ packageJson });

describe('files-field (npm)', () => {
  const npmBinding = bindingForTest(filesField, 'npm');

  it('is N/A for private packages', () => {
    expect(npmBinding.check(ctxWith({ name: 'x', private: true }), {}).state).toBe('na');
  });

  it('reports missing and empty publication allow-lists with manual guidance', () => {
    const status = npmBinding.check(ctxWith({ name: 'x' }), {});

    expect(status.state).toBe('violation');
    expect(npmBinding.check(ctxWith({ files: [], name: 'x' }), {}).state).toBe('violation');

    expect(filesField.severity).toBe('info');

    const steps = manualSteps(status);

    const firstStep = steps[0];
    expect(firstStep).toContain('npm pack --dry-run');
  });

  it('passes when a non-empty files allow-list is present', () => {
    expect(npmBinding.check(ctxWith({ files: ['dist'], name: 'x' }), {}).state).toBe('ok');
  });
});

describe('files-field (deno)', () => {
  const denoBinding = bindingForTest(filesField, 'deno');

  it('is N/A when deno.json has no `name` (deno is not publishable without one)', () => {
    // A nameless deno.json cannot be published to JSR. Surfacing a
    // `publish.include` finding for an internal/CLI-only deno repo is
    // noise — mirror the package.json binding's `isPublishable` guard.
    expect(denoBinding.check(ctxWith(), {}).state).toBe('na');
    expect(denoBinding.check(ctxWith(), { name: '   ' }).state).toBe('na');
  });

  it('flags a violation when publish.include is absent on a publishable deno.json', () => {
    expect(denoBinding.check(ctxWith(), { name: '@scope/pkg' }).state).toBe('violation');
  });

  it('flags a violation when publish.include is an empty array', () => {
    expect(
      denoBinding.check(ctxWith(), { name: '@scope/pkg', publish: { include: [] } }).state,
    ).toBe('violation');
  });

  it('passes when a non-empty publish.include is present', () => {
    expect(
      denoBinding.check(ctxWith(), { name: '@scope/pkg', publish: { include: ['mod.ts'] } }).state,
    ).toBe('ok');
  });
});

it.each(['pnpm', 'yarn', 'bun', 'aube'] as const)(
  'routes %s publication allow-list checks',
  (pm) => {
    const binding = bindingForTest(filesField, pm);

    expect(binding.check(ctxWith({ name: 'x' }), {}).state).toBe('violation');
    expect(binding.check(ctxWith({ name: 'x', files: ['dist'] }), {}).state).toBe('ok');
  },
);

describe('Malformed settings', () => {
  const ctx = makeCtx();

  it.each([{ value: [false] }, { value: ['   '] }, { value: Array(1) }])(
    'does not accept malformed allowlists: %j',
    ({ value }) => {
      expect(
        bindingForTest(filesField, 'deno').check(ctx, {
          name: '@scope/pkg',
          publish: { include: value },
        }).state,
      ).toBe('violation');
    },
  );
});
