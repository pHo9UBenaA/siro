// Shorten absolute paths in gen-rule rollback diagnostics relative to
// the repo root so the user sees `src/domain/rules/foo.ts` instead of the
// full `/Users/.../moat/src/...` prefix.
//
// Extracted from scripts/gen/rule.mjs so the regex can be unit-tested
// without spawning the full driver and to keep its contract — single
// replacement, path may contain spaces — explicit and pinned by tests.
//
// `rollbackWrites` (rule-rollback.mjs) emits one message per failure
// in the exact form `rollback of <path> also failed — <reason>`, so we
// terminate the path capture at the literal ` also failed` rather than
// the first whitespace. A `\S+` capture truncates paths that contain
// spaces (e.g. `/Users/First Last/...` on macOS), turning the rollback
// hint into a misleading partial path — the very information the user
// needs to finish cleanup by hand.

import path from 'node:path';

/**
 * @param {string} message
 * @param {string} root - Repo root for `relative` resolution.
 * @returns {string}
 */
const LAST_ELEMENT = -1;

export const shortenRollbackPaths = (message, root) =>
  message.replace(/rollback of (?<absPath>.+?) also failed/u, (...args) => {
    const groups = args.at(LAST_ELEMENT);
    return `rollback of ${path.relative(root, groups.absPath)} also failed`;
  });
