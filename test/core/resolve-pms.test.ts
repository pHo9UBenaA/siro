import type { RepoContext } from '../../src/core/contracts/repo-context.ts';
import { resolvePMs } from '../../src/core/resolve-pms.ts';
import { UsageError } from '../../src/core/contracts/errors.ts';
import { makeCtx } from '../helpers/ctx.ts';
import { captureThrown } from '../helpers/errors.ts';

const ctx = (files: readonly string[] = []): RepoContext => makeCtx({ files });

describe('resolvePMs — detection', () => {
  it('returns the auto-detected PMs in canonical order when no restriction is set', () => {
    expect(resolvePMs(ctx(['pnpm-lock.yaml', 'package-lock.json']), {})).toStrictEqual([
      'npm',
      'pnpm',
    ]);
  });

  it('intersects detected PMs with the allowed list when both are non-empty', () => {
    expect(
      resolvePMs(ctx(['pnpm-lock.yaml', 'package-lock.json']), { allowed: ['pnpm'] }),
    ).toStrictEqual(['pnpm']);
  });
});

describe('resolvePMs — override', () => {
  it('honors a single-PM override and skips detection entirely', () => {
    const repo = {
      ...ctx(['pnpm-lock.yaml']),
      exists: () => {
        throw new Error('detection must not read the filesystem when a PM is forced');
      },
    };
    expect(resolvePMs(repo, { pmOverride: 'npm' })).toStrictEqual(['npm']);
  });

  it('applies the allowed restriction to an override and blames --pm', () => {
    const error = captureThrown(() =>
      resolvePMs(ctx([]), { allowed: ['pnpm'], pmOverride: 'npm' }),
    );
    expect(error).toBeInstanceOf(UsageError);
    expect(error).toMatchObject({ message: expect.stringMatching(/--pm npm/u) });
    expect(error).not.toMatchObject({ message: expect.stringMatching(/detected/iu) });
  });
});

describe('resolvePMs — error cases: no detection', () => {
  it('throws UsageError listing every PM when nothing was detected', () => {
    const error = captureThrown(() => resolvePMs(ctx([]), {}));
    expect(error).toBeInstanceOf(UsageError);
    expect(error).toMatchObject({
      message: expect.stringMatching(/no package manager detected.*pass --pm/iu),
    });
  });

  it('throws UsageError naming only the allowed set when nothing was detected', () => {
    expect(() => resolvePMs(ctx([]), { allowed: ['pnpm', 'yarn'] })).toThrow(
      /no package manager detected.*restricts pms to pnpm, yarn/iu,
    );
  });
});

describe('resolvePMs — error cases: allowed-list mismatch', () => {
  it('throws UsageError naming the conflicting set when detected and allowed do not intersect', () => {
    expect(() => resolvePMs(ctx(['package-lock.json']), { allowed: ['pnpm'] })).toThrow(
      /detected pms \(npm\).*do not match.*pms \(pnpm\)/iu,
    );
  });
});
