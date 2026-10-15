# Readability review loop journal

Running log for the 24-hour readability review-and-fix loop on the `siro`
repository. Each entry records the direction reviewed, what was found or
rejected, the commits produced, and candidate directions for the next pass.
Append new entries at the bottom; do not rewrite earlier ones.

## 2026-10-15T22:28Z — discovery and scan limits

Direction: discovery and scan limits (`src/core/discovery.ts`,
`src/core/bounded-file-system.ts`, `src/core/contracts/scan-limits.ts`,
`src/adapters/node-file-system.ts`), with a secondary sweep across adapters,
contracts, rules, CLI, reporters, docs and test helpers.

Findings: clean. No high-value, low-risk readability change was warranted.

- `discover` counts the inspected set, the pending frontier and the directory
  being added via a named closure (`projectedDirectoryCount`), and the comment
  states the `+1`. Depth uses code-unit length, not host locale, with a portable
  comparator on `RelPath`. Control flow is easy to follow.
- `boundedFileSystem` keeps budgets in one place and defers response validation
  to discovery, which the comments explain. `checkConfigDepth` and `outputBudget`
  carry the WHY (shared mappings, output failure exit 70).
- `node-file-system.ts` separates the strict-path checker, the stat/open guard
  and the read loop; the NONBLOCK/NOFOLLOW and re-fstat rationale is documented.

Rejected items (considered, deliberately not changed):

- `for (const finding of evaluated) findings.push(finding)` in `run-lint.ts`,
  `manifest-checks.ts` and `lint.ts` is repeated, but replacing it with
  `findings.push(...evaluated)` risks argument-limit failures for oversized
  custom-rule groups (see CHANGELOG 0.6.2). The loops are intentional.
- Duplicated `context.limits?.maxOutputBytes ?? DEFAULT_SCAN_LIMITS.maxOutputBytes`
  across the three reporters shares the `DEFAULT_SCAN_LIMITS` source of truth;
  a helper would add indirection for a one-line fallback.
- The double `resolveScanLimits` call on the CLI/`loadConfig` path is idempotent;
  removing it would require changing the `loadConfigFromFileSystem` signature.
- `directory === '.' ? 0 : directory.split('/').length` appears twice, but the
  root special case differs from the child case, so a shared helper adds little.
- Every `//` comment in `src` explains a constraint or rejected alternative, not
  the mechanics; no WHAT comments to delete.

Actions: none (documentation only). No code commits.

Next candidate directions:

1. Performance and allocations on hot paths (`evaluateBinding` context spread,
   per-(rule,target) project-type resolution in `runLint`).
2. Determinism, timezone and platform behavior (`minimum-release-age`,
   `deno-release-age`, `node-paths`).
3. Test readability and helpers (`test/core/rules/*`, `test/helpers/*`).
