import assert from 'node:assert';

import { pinExactVersions } from '../../../src/core/rules/pin-exact-versions.ts';
import { provenance } from '../../../src/core/rules/provenance.ts';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import { minimumReleaseAge } from '../../helpers/rules.ts';

describe('pnpm bindings — pin-exact-versions', () => {
  it('requires savePrefix empty', () => {
    expect.hasAssertions();
    const bd = pinExactVersions.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { savePrefix: '' }).state).toBe('ok');
  });
});

describe('pnpm bindings — age and lockfile', () => {
  it('checks minimumReleaseAge (3 days in minutes)', () => {
    expect.hasAssertions();
    const bd = minimumReleaseAge.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { minimumReleaseAge: 1440 }).state).toBe('ok');
    const setKey = automaticOperations(bd.check(ctx(), {})).find((op) => op.op === 'setKey');
    assert(setKey, 'expected setKey op');
    expect(setKey).toMatchObject({
      keyPath: ['minimumReleaseAge'],
      value: 4320,
    });
  });
});

describe('pnpm bindings — files-field and provenance', () => {
  it('provenance binds to .npmrc for pnpm (shared with npm)', () => {
    expect.hasAssertions();
    const bd = provenance.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
    const okState = bd.check(ctx(), { provenance: true }).state;
    expect(okState).toBe('ok');
    const violationState = bd.check(ctx(), {}).state;
    expect(violationState).toBe('violation');
  });
});
