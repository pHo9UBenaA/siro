import assert from 'node:assert';
import {
  expectMessageContains,
  expectMessageContainsAndAvoids,
} from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { minimumReleaseAge } from '../../../src/domain/rules/minimum-release-age.ts';

vi.setConfig({ testTimeout: 5000 });

describe('minimum-release-age (npm)', () => {
  const ctx = makeCtx();
  const { npm } = minimumReleaseAge.bindings;
  if (!npm) {
    throw new TypeError('expected npm binding');
  }

  it('is a warn-severity rule targeting .npmrc', () => {
    expect.hasAssertions();
    expect(minimumReleaseAge.severity).toBe('warn');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('flags a violation when min-release-age is missing or not positive', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, {}).state).toBe('violation');
    expect(npm.check(ctx, { 'min-release-age': 0 }).state).toBe('violation');
  });

  it('passes when min-release-age is a positive number', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, { 'min-release-age': 7 }).state).toBe('ok');
  });

  it('fixes by setting a positive min-release-age', () => {
    expect.hasAssertions();
    const ops = npm.fix(ctx);
    const setKey = ops.find((op) => op.op === 'setKey');
    expect(setKey).toMatchObject({ keyPath: ['min-release-age'] });
    expect(setKey).toMatchObject({ value: expect.any(Number) });
  });
});

const { deno } = minimumReleaseAge.bindings;
if (!deno) {
  throw new TypeError('expected deno binding');
}

describe('minimum-release-age (deno)', () => {
  const ctx = makeCtx();

  it('targets deno.json', () => {
    expect.hasAssertions();
    expect(deno.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
  });

  it('passes when minimumDependencyAge is an ISO-8601 duration string', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: 'P3D' }).state).toBe('ok');
  });

  it('passes when minimumDependencyAge is a positive number (minutes)', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: 4320 }).state).toBe('ok');
  });

  it('passes when minimumDependencyAge is an object with age property', () => {
    expect.hasAssertions();
    expect(
      deno.check(ctx, { minimumDependencyAge: { age: 'P3D', exclude: ['npm:foo'] } }).state,
    ).toBe('ok');
  });

  it('flags a violation when minimumDependencyAge is unset', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, {}).state).toBe('violation');
  });

  it('flags a violation when minimumDependencyAge is "0" (disabled)', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: '0' }).state).toBe('violation');
  });

  it('flags a violation when minimumDependencyAge is 0 (disabled)', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: 0 }).state).toBe('violation');
  });

  it('fix writes P3D as the recommended value', () => {
    expect.hasAssertions();
    const ops = deno.fix(ctx);
    const setKey = ops.find((op) => op.op === 'setKey');
    expect(setKey).toMatchObject({ keyPath: ['minimumDependencyAge'], value: 'P3D' });
  });
});

describe('minimum-release-age tells users which PM version made the key available or safe by default', () => {
  const ctx = makeCtx();

  it('on pnpm: tells the user from which pnpm version the safe default applies', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: minimumReleaseAge.bindings.pnpm,
      ctx,
      substrings: ['default safe since pnpm 11.0.0'],
    });
  });

  it('on pnpm: no longer prefixes a hand-written "pnpm 11+ defaults..." note', () => {
    expect.hasAssertions();
    const pnpmBinding = minimumReleaseAge.bindings.pnpm;
    assert(pnpmBinding, 'expected pnpm binding');
    expect(pnpmBinding.check(ctx, {})).toMatchObject({
      message: expect.not.stringMatching(/pnpm 11\+ defaults/u),
      state: 'violation',
    });
  });

  it('on npm: tells the user from which npm version the min-release-age key is available', () => {
    expect.hasAssertions();
    expectMessageContainsAndAvoids({
      binding: minimumReleaseAge.bindings.npm,
      ctx,
      options: {
        contains: ['available since npm 11.10.0'],
        notMatching: [/npm >= 11\.10/u, /available since npm 11\.10(?!\.\d)/u],
      },
    });
  });

  it('on yarn: tells the user from which yarn version the safe default applies', () => {
    expect.hasAssertions();
    expectMessageContainsAndAvoids({
      binding: minimumReleaseAge.bindings.yarn,
      ctx,
      options: {
        contains: ['default safe since yarn 4.15.0'],
        notMatching: [/yarn 4\.15\+ defaults/u],
      },
    });
  });

  it('on pnpm: also tells the user from which pnpm version the key became available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: minimumReleaseAge.bindings.pnpm,
      ctx,
      substrings: ['available since pnpm 10.16.0'],
    });
  });

  it('on yarn: also tells the user from which yarn version the key became available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: minimumReleaseAge.bindings.yarn,
      ctx,
      substrings: ['available since yarn 4.10.0'],
    });
  });
});
