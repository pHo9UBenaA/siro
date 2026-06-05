import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { PMS } from '../../../src/domain/entities/pms.ts';
import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';
import { resolvePMs } from '../../../src/domain/services/resolve-pms.ts';
import { UsageError } from '../../../src/shared/errors.ts';

vi.setConfig({ testTimeout: 5000 });

const ctx = (files: readonly string[] = []): RepoContext => makeCtx({ files });

const captureThrow = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected fn to throw');
};

describe('resolvePMs — detection', () => {
  it('returns the auto-detected PMs in canonical order when no restriction is set', () => {
    expect.hasAssertions();
    expect(resolvePMs(ctx(['pnpm-lock.yaml', 'package-lock.json']), {})).toStrictEqual([
      'npm',
      'pnpm',
    ]);
  });

  it('intersects detected PMs with the allowed list when both are non-empty', () => {
    expect.hasAssertions();
    expect(
      resolvePMs(ctx(['pnpm-lock.yaml', 'package-lock.json']), { allowed: ['pnpm'] }),
    ).toStrictEqual(['pnpm']);
  });
});

describe('resolvePMs — override', () => {
  it('honors a single-PM override and skips detection entirely', () => {
    expect.hasAssertions();
    expect(resolvePMs(ctx(['pnpm-lock.yaml']), { pmOverride: 'npm' })).toStrictEqual(['npm']);
  });

  it('still applies the allowed restriction on top of an override', () => {
    expect.hasAssertions();
    expect(() => resolvePMs(ctx([]), { allowed: ['pnpm'], pmOverride: 'npm' })).toThrow(UsageError);
  });

  it('blames --pm (not detection) when a forced PM is excluded by the config allow-list', () => {
    expect.hasAssertions();
    const error = captureThrow(() => resolvePMs(ctx([]), { allowed: ['pnpm'], pmOverride: 'npm' }));
    assert(error instanceof Error, 'expected an Error');
    expect(error.message).toMatch(/--pm npm/u);
    expect(error.message).not.toMatch(/detected/iu);
  });
});

describe('resolvePMs — error cases: no detection', () => {
  it('throws UsageError when nothing was detected and no override is given', () => {
    expect.hasAssertions();
    expect(() => resolvePMs(ctx([]), {})).toThrow(/no package manager detected.*pass --pm/iu);
  });

  it('lists every PM in PMS in the no-detection error message', () => {
    expect.hasAssertions();
    const error = captureThrow(() => resolvePMs(ctx([]), {}));
    assert(error instanceof Error, 'expected an Error');
    for (const pm of PMS) {
      expect(error.message).toContain(pm);
    }
  });

  it('throws UsageError naming only the allowed set when nothing was detected', () => {
    expect.hasAssertions();
    expect(() => resolvePMs(ctx([]), { allowed: ['pnpm', 'yarn'] })).toThrow(
      /no package manager detected.*restricts pms to pnpm, yarn/iu,
    );
  });
});

describe('resolvePMs — error cases: allowed-list mismatch', () => {
  it('throws UsageError naming the conflicting set when detected and allowed do not intersect', () => {
    expect.hasAssertions();
    expect(() => resolvePMs(ctx(['package-lock.json']), { allowed: ['pnpm'] })).toThrow(
      /detected pms \(npm\).*do not match.*pms \(pnpm\)/iu,
    );
  });
});
