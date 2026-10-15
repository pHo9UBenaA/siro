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

## 2026-10-15T22:35Z — CLI entry, argument parsing and error/exit handling

Direction: CLI and argument parsing plus error handling and exit codes
(`src/cli.ts`, `src/cli/parse-args.ts`, `src/cli/parsers.ts`, `src/cli/commands.ts`,
`src/cli/help.ts`, `src/core/contracts/errors.ts`, `src/core/lint-command.ts`,
`src/core/filter.ts`, `src/adapters/node-errors.ts`, `src/adapters/node-io.ts`),
with a secondary sweep across core pipeline, rules, adapters, contracts,
reporters, scripts, bench, tests and docs prose.

Findings: clean. No high-value, low-risk readability change was warranted.

- `parseCommand` keeps one error slot (`firstError ??=`) and one exit path; known
  value flags alone consume the next token, and the `--` / removed-flag cases are
  explicit. `ParsedCommand` variants and the exhaustive `never` checks in
  `cli.ts`/`help.ts` are easy to follow.
- `handleError` separates `SiroError.exitCode`, numeric-errno filesystem failures
  (exit 2) and unexpected exceptions (exit 70). That mapping matches the help
  EXIT CODES table and `docs/configuration.md`; `filter.ts` exit codes are
  isolated from output/usage codes.
- `node-io.ts` documents why one error listener is retained after first use, and
  `node-errors.ts` scopes the guard to exactly `Error` + string `code`.
- `lint-command.ts` keeps the display threshold (`info`) distinct from the
  failure threshold (`error`) with a one-line WHY, and drains legacy unawaited
  writes before propagating a reporter failure.

Rejected items (considered, deliberately not changed):

- The inline `['json', 'no-config', 'strict-filesystem']` once-only list in
  `parse-args.ts` duplicates a subset of `BOOLEAN_FLAGS`. Naming it would add a
  constant for one condition; `help`/`version` are intentionally repeatable, and
  the inline list reads clearly where it is used.
- `isNonBlankString` (`core/rules/config-predicates.ts`) and `isPublishableName`
  (`core/resolve-project-type.ts`) are the same one-line predicate. Sharing it
  would point the project-type resolver at `core/rules/*` (a backwards
  dependency) or add a new contract file for one line; the duplication is
  cheaper than either.
- `typeof x === 'undefined'` vs `x === undefined` appears in different files;
  purely stylistic, no reader cost, not worth a cross-file sweep.
- Existing `for (const finding of evaluated) findings.push(finding)` loops stay
  (argument-limit safety for oversized custom-rule groups; see 0.6.2).

Actions: none (documentation only). No code commits.

Next candidate directions:

1. Performance and allocations on hot paths (`evaluateBinding` context spread,
   per-(rule,target) project-type resolution in `runLint`).
2. Test readability and helpers (`test/core/*`, `test/helpers/*`): only a shallow
   pass so far; look for duplicated fixture builders across the largest suites.
3. Architecture/import boundaries: re-check `test/architecture.test.ts` stays in
   sync with the area map after any new source file or dependency edge.
