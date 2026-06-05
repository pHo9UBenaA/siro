import assert from 'node:assert';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import type { PackageJson } from '../../../src/domain/schemas/package-json.ts';
import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';

vi.setConfig({ testTimeout: 5000 });

const ctxWith = (packageJson?: PackageJson): RepoContext => makeCtx({ packageJson });

describe('files-field (npm)', () => {
  const npmBinding = filesField.bindings.npm;
  if (!npmBinding) {
    throw new TypeError('expected npm binding');
  }

  it('is an info-severity rule', () => {
    expect.hasAssertions();
    expect(filesField.severity).toBe('info');
  });

  it('is N/A for private packages', () => {
    expect.hasAssertions();
    expect(npmBinding.check(ctxWith({ name: 'x', private: true }), {}).state).toBe('na');
  });

  it('flags a violation when files is missing or empty', () => {
    expect.hasAssertions();
    expect(npmBinding.check(ctxWith({ name: 'x' }), {}).state).toBe('violation');
    expect(npmBinding.check(ctxWith({ files: [], name: 'x' }), {}).state).toBe('violation');
  });

  it('passes when a non-empty files allow-list is present', () => {
    expect.hasAssertions();
    expect(npmBinding.check(ctxWith({ files: ['dist'], name: 'x' }), {}).state).toBe('ok');
  });

  it('fix is advisory (a note), not auto-writable', () => {
    expect.hasAssertions();
    const ops = npmBinding.fix(ctxWith({ name: 'x' }));
    const FIRST_ELEMENT = 0;
    const firstOp = ops[FIRST_ELEMENT];
    assert(firstOp, 'expected at least one fix op');
    expect(firstOp.op).toBe('note');
  });
});

describe('files-field (deno)', () => {
  const denoBinding = filesField.bindings.deno;
  if (!denoBinding) {
    throw new TypeError('expected deno binding');
  }

  it('is N/A when deno.json has no `name` (deno is not publishable without one)', () => {
    expect.hasAssertions();
    // A nameless deno.json cannot be published to JSR. Surfacing a
    // `publish.include` finding for an internal/CLI-only deno repo is
    // noise — mirror the package.json binding's `isPublishable` guard.
    expect(denoBinding.check(ctxWith(), {}).state).toBe('na');
  });

  it('flags a violation when publish.include is absent on a publishable deno.json', () => {
    expect.hasAssertions();
    expect(denoBinding.check(ctxWith(), { name: '@scope/pkg' }).state).toBe('violation');
  });

  it('flags a violation when publish.include is an empty array', () => {
    expect.hasAssertions();
    expect(
      denoBinding.check(ctxWith(), { name: '@scope/pkg', publish: { include: [] } }).state,
    ).toBe('violation');
  });

  it('passes when a non-empty publish.include is present', () => {
    expect.hasAssertions();
    expect(
      denoBinding.check(ctxWith(), { name: '@scope/pkg', publish: { include: ['mod.ts'] } }).state,
    ).toBe('ok');
  });
});
