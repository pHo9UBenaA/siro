import assert from 'node:assert';
import type {
  GenRuleWrite,
  RollbackFs,
  RollbackReporter,
} from '../../scripts/gen/lib/rule-rollback.d.mts';
import { rollbackWrites } from '../../scripts/gen/lib/rule-rollback.mjs';

vi.setConfig({ testTimeout: 5000 });

const EXPECTED_CALL_COUNT = 1;
const FIRST_CALL_INDEX = 0;
const FIRST_ARG_INDEX = 0;

const makeFakeFs = (): {
  fs: RollbackFs;
  unlinks: string[];
  writes: { content: string; path: string }[];
} => {
  const writes: { content: string; path: string }[] = [];
  const unlinks: string[] = [];
  return {
    fs: {
      unlinkSync: (path: string): void => {
        unlinks.push(path);
      },
      writeFileSync: (path: string, content: string): void => {
        writes.push({ content, path });
      },
    },
    unlinks,
    writes,
  };
};

const noopReporter = (): void => {
  // no-op
};

const makeEnoentFs = (): RollbackFs => ({
  unlinkSync: (): void => {
    throw Object.assign(new Error('not found'), { code: 'ENOENT' });
  },
  writeFileSync: (): void => {
    // no-op
  },
});

const makeEpermFs = (): RollbackFs => ({
  unlinkSync: (path: string): void => {
    if (path === '/perm-denied.ts') {
      throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
    }
  },
  writeFileSync: (): void => {
    // no-op
  },
});

const makeDiskFullFs = (): RollbackFs => ({
  unlinkSync: (): void => {
    // no-op
  },
  writeFileSync: (): void => {
    throw new Error('disk full');
  },
});

describe('rollbackWrites — ordering and restore', () => {
  it('reverses the order so the most-recently-applied write rolls back first', () => {
    expect.hasAssertions();
    const done: GenRuleWrite[] = [
      { path: '/a.ts', previousContent: 'old-a' },
      { path: '/b.ts', previousContent: 'old-b' },
      { path: '/c.ts', previousContent: void 0 },
    ];
    const { fs, unlinks, writes } = makeFakeFs();
    rollbackWrites(done, fs, noopReporter);
    expect(unlinks).toStrictEqual(['/c.ts']);
    expect(writes.map((wr) => wr.path)).toStrictEqual(['/b.ts', '/a.ts']);
  });

  it('restores the previous content for entries that overwrote an existing file', () => {
    expect.hasAssertions();
    const done: GenRuleWrite[] = [{ path: '/x.ts', previousContent: 'original' }];
    const { fs, writes } = makeFakeFs();
    rollbackWrites(done, fs, noopReporter);
    expect(writes).toStrictEqual([{ content: 'original', path: '/x.ts' }]);
  });

  it('unlinks entries whose previousContent is undefined (creations)', () => {
    expect.hasAssertions();
    const done: GenRuleWrite[] = [{ path: '/new.ts', previousContent: void 0 }];
    const { fs, unlinks } = makeFakeFs();
    rollbackWrites(done, fs, noopReporter);
    expect(unlinks).toStrictEqual(['/new.ts']);
  });
});

describe('rollbackWrites — error handling', () => {
  it('swallows ENOENT during unlink (file already gone is the desired state)', () => {
    expect.hasAssertions();
    const report = vi.fn<RollbackReporter>();
    rollbackWrites([{ path: '/gone.ts', previousContent: void 0 }], makeEnoentFs(), report);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a non-ENOENT unlink failure without throwing so the loop continues', () => {
    expect.hasAssertions();
    const report = vi.fn<RollbackReporter>();
    rollbackWrites(
      [
        { path: '/perm-denied.ts', previousContent: void 0 },
        { path: '/ok.ts', previousContent: void 0 },
      ],
      makeEpermFs(),
      report,
    );
    expect(report).toHaveBeenCalledTimes(EXPECTED_CALL_COUNT);
    const firstCall = report.mock.calls[FIRST_CALL_INDEX];
    assert(firstCall, 'expected report call');
    const firstCallFirstArg = firstCall[FIRST_ARG_INDEX];
    expect(firstCallFirstArg).toMatch(/rollback of \/perm-denied\.ts also failed/u);
  });

  it('reports a write failure during restore without throwing', () => {
    expect.hasAssertions();
    const report = vi.fn<RollbackReporter>();
    rollbackWrites([{ path: '/restore-me.ts', previousContent: 'old' }], makeDiskFullFs(), report);
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining('rollback of /restore-me.ts also failed — disk full'),
    );
  });
});
