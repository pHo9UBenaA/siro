// Roll back a partial `scripts/gen/rule.mjs` write batch.
//
// Extracted so the function can be unit-tested without spawning the full
// gen/rule driver (which mutates checked-in source files). Pure logic +
// injectable fs lets callers feed in an in-memory FS for tests and the
// real `node:fs` in production.
//
// Behaviour contracts pinned by the test suite:
//   - reverse-order restore (LIFO) so a freshly-created file goes away
//     before the one whose creation preceded it
//   - `previousContent === undefined` means the entry created a new file →
//     unlink it; any other value means the entry overwrote an existing
//     file → restore that content
//   - ENOENT on unlink is benign (a concurrent process already removed it);
//     all other errno propagates via the reporter so the user can finish
//     cleanup by hand
//   - the reporter is invoked once per failure with a human-readable line;
//     the function never throws — rollback failures must NOT shadow the
//     original error that triggered the rollback

const isENOENT = (err) =>
  Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT');

const unlinkIfExists = (fs, filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (!isENOENT(error)) {
      throw error;
    }
  }
};

export const rollbackWrites = (done, fs, report) => {
  for (const wr of [...done].toReversed()) {
    try {
      if (typeof wr.previousContent === 'undefined') {
        unlinkIfExists(fs, wr.path);
      } else {
        fs.writeFileSync(wr.path, wr.previousContent);
      }
    } catch (error) {
      let errMsg = String(error);
      if (error instanceof Error) {
        errMsg = error.message;
      }
      report(`rollback of ${wr.path} also failed — ${errMsg}`);
    }
  }
};
