import assert from 'node:assert';
import type {
  GenRuleWrite,
  RollbackFs,
  RollbackReporter,
} from '../../scripts/gen/lib/rule-rollback.d.mts';
import { atomicWriteSync, rollbackWrites } from '../../scripts/gen/lib/rule-rollback.mjs';

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

describe('atomicWriteSync — failure isolation', () => {
  it('keeps the target intact and removes a partial temp file after a staged write failure', () => {
    expect.hasAssertions();
    const targetPath = '/rule-id.ts';
    const tempPath = '/rule-id.ts.tmp';
    const files = new Map([[targetPath, 'original']]);
    const fs = {
      renameSync: (): void => {
        throw new Error('rename should not be reached');
      },
      unlinkSync: (filePath: string): void => {
        files.delete(filePath);
      },
      writeFileSync: (filePath: string): void => {
        files.set(filePath, 'partial');
        throw new Error('disk full');
      },
    };
    let failure = '';
    try {
      atomicWriteSync(
        { nextContent: 'replacement', path: targetPath, previousContent: 'original' },
        fs,
        tempPath,
      );
    } catch (error) {
      assert(error instanceof Error, `expected Error, received ${String(error)}`);
      failure = error.message;
    }
    expect({ failure, files: Array.from(files.entries()) }).toStrictEqual({
      failure: 'disk full',
      files: [[targetPath, 'original']],
    });
  });
});

describe('rollbackWrites — ordering and restore', () => {
  it('reverses the order so the most-recently-applied write rolls back first', () => {
    expect.hasAssertions();
    const done = [
      { path: '/a.ts', previousContent: 'old-a' },
      { path: '/b.ts', previousContent: 'old-b' },
      { path: '/c.ts', previousContent: void 0 },
    ] as const satisfies readonly GenRuleWrite[];
    const { fs, unlinks, writes } = makeFakeFs();
    rollbackWrites(done, fs, noopReporter);
    expect(unlinks).toStrictEqual(['/c.ts']);
    expect(writes.map((wr) => wr.path)).toStrictEqual(['/b.ts', '/a.ts']);
  });

  it('restores the previous content for entries that overwrote an existing file', () => {
    expect.hasAssertions();
    const done = [
      { path: '/x.ts', previousContent: 'original' },
    ] as const satisfies readonly GenRuleWrite[];
    const { fs, writes } = makeFakeFs();
    rollbackWrites(done, fs, noopReporter);
    expect(writes).toStrictEqual([{ content: 'original', path: '/x.ts' }]);
  });

  it('unlinks entries whose previousContent is undefined (creations)', () => {
    expect.hasAssertions();
    const done = [
      { path: '/new.ts', previousContent: void 0 },
    ] as const satisfies readonly GenRuleWrite[];
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
