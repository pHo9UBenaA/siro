import { shortenRollbackPaths } from '../../scripts/gen/lib/rule-paths.mjs';

vi.setConfig({ testTimeout: 5000 });

describe(shortenRollbackPaths, () => {
  it('relativises a path that has no spaces', () => {
    expect.hasAssertions();
    const root = '/Users/dev/projects/moat';
    const msg = 'rollback of /Users/dev/projects/moat/src/domain/rules/foo.ts also failed — EACCES';
    expect(shortenRollbackPaths(msg, root)).toBe(
      'rollback of src/domain/rules/foo.ts also failed — EACCES',
    );
  });

  it('relativises a path that contains spaces (e.g. macOS home with a space)', () => {
    expect.hasAssertions();
    // The previous regex `(\S+)` would truncate the captured path at the
    // first whitespace, yielding a misleading rollback message — the very
    // information the operator needs to finish cleanup by hand.
    const root = '/Users/First Last/projects/moat';
    const msg =
      'rollback of /Users/First Last/projects/moat/src/domain/rules/foo.ts also failed — EACCES';
    expect(shortenRollbackPaths(msg, root)).toBe(
      'rollback of src/domain/rules/foo.ts also failed — EACCES',
    );
  });

  it('leaves messages without a rollback prefix untouched', () => {
    expect.hasAssertions();
    const msg = 'some other diagnostic with /absolute/path/foo.ts inside';
    expect(shortenRollbackPaths(msg, '/some/root')).toBe(msg);
  });

  it('only rewrites the first occurrence and leaves the rest verbatim (rollbackWrites emits one line per failure)', () => {
    expect.hasAssertions();
    const root = '/r';
    const msg = 'rollback of /r/a.ts also failed — x. rollback of /r/b.ts also failed — y';
    // Each diagnostic line is reported separately by rollbackWrites, so a
    // single-replace contract is the documented one. Pin BOTH halves: the
    // first path is relativised, the second path stays absolute. A future
    // switch to a global replace (e.g. swapping in `.replaceAll` or the
    // `/g` flag) would rewrite both occurrences and silently change the
    // contract — assert the unrewritten tail so that regression is loud.
    const out = shortenRollbackPaths(msg, root);
    expect(out).toBe('rollback of a.ts also failed — x. rollback of /r/b.ts also failed — y');
  });
});
