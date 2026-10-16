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

## 2026-10-15T22:48Z — test readability and helpers

Direction: test readability and helpers (`test/helpers/*`,
`test/core/package-inspection.test.ts`, `test/core/run-lint*.test.ts`, the largest
rule suites), with a secondary sweep into determinism/platform behavior
(`core/contracts/date-time.ts`, `core/rules/deno-release-age.ts`,
`adapters/node-paths.ts`) and import boundaries (`test/architecture.test.ts`, the
core manifest dispatch).

Findings: clean. No high-value, low-risk readability change was warranted.

- `test/helpers/*` are small and purpose-scoped: `makeCtx` merges overrides with
  defaults in one place, `createMemFileSystem` mirrors the native ENOENT-only
  semantics, `assertCheckState`/`bindingForTest` narrow without hiding the actual
  result, and the npm `fixtures.ts` says why its fixture passes the default
  threshold.
- The largest suite (`package-inspection.test.ts`) keeps one local `inspect` and
  one `packageFindings` helper; its `it.each` tables label behavior (`rejects
invalid scope %j`, `$name`) instead of indexing cases, so it reads well despite
  its length. `run-lint.test.ts` / `run-lint-evaluation.test.ts` share the same
  `createRepositoryEvaluation` + stub-codec shape and comment that the bindings
  test metadata, not parsing.
- `deno-release-age.ts` documents each regex against the Deno source and
  normalizes only the leap second JS Date cannot represent; `date-time.ts` states
  that offsetless parsing uses host semantics; `node-paths.ts` explains why it
  does not re-validate native components. Determinism is deliberate, not
  incidental.

Rejected items (considered, deliberately not changed):

- The manifest filename union `'package.json' | 'deno.json'` is written inline in
  `discovery.ts` (three times) and named `ManifestFile` in `manifest-checks.ts`.
  Extracting a shared contract adds a file/import for a two-member union
  TypeScript already checks, with no reader cost in the literal; not worth the
  indirection (same reasoning as the `isNonBlankString` duplication rejected
  earlier).
- `Reflect.apply(inspect, …)` in `package-inspection.test.ts` deliberately passes
  intentionally invalid options past the type checker. A cast would hide that
  intent; the `Reflect.apply` form reads as off-type on purpose.
- The duplicated version merge in `lint.ts` `resolveDirectoryTargets` differs
  between the cwd and installation-root branches (config `pmVersions` applies only
  to cwd), so a shared helper would need a flag for a one-line spread.
- `cutoffMs < nowMs` in `minimum-release-age.ts` looks implied by `ageDays > 0`,
  but it is the semantic condition ("cutoff in the past") while
  `Number.isFinite(cutoffMs)` guards overflow; neither is redundant in intent.

Actions: none (documentation only). No code commits.

Next candidate directions:

1. Performance and allocations on hot paths (`evaluateBinding` context spread,
   per-(rule,target) project-type resolution in `runLint`) — measure before
   changing, since the current shape is already O(rules × targets).
2. Comment value across `src` and the hand-written docs (`docs/configuration.md`,
   `docs/json-output.md`): confirm each WHY still matches the code it explains.
3. Architecture/import boundaries: re-check `test/architecture.test.ts` stays in
   sync with the area map after any new source file or dependency edge.

## 2026-10-16T00:04Z — core rules and the rule registry

Direction: core rules and the rule registry (`src/core/rules/*`,
`src/core/rules/builders/*`, `src/core/contracts/rule.ts`), with a secondary
sweep across the public API and contracts (`src/index.ts`, `src/core/contracts/*`,
`src/core/lint.ts`) and docs prose (`README.md`, `docs/configuration.md`,
`docs/json-output.md`).

Findings: clean. No high-value, low-risk readability change was warranted.

- Every rule is a small `defineRule({...})` literal whose `check` reads as the
  policy sentence it implements; the binding `file`/`docs`/`versionNote` stay next
  to the check instead of in a central table, so one rule reads in isolation.
- `builders/require-config-key.ts` is the one shared factory and earns it: it
  validates bindings (plain object, known PMs) and the `accept`/`applies`
  predicates once, and `withAubeParanoid` layers aube's requirement as a named
  wrapper rather than a mode flag. The `label`/`assertSynchronous` pairing reports
  async predicates as config errors without unhandled rejections.
- `remediation.ts` / `remediation-availability.ts` keep the manual/operation
  shapes in one place; `evaluate-binding.ts` is the single response boundary and
  fixes output key order, so rule literals never depend on property order.
- `builtin-rules.ts` registers the built-ins in one place with no duplicated id
  map; `contracts/rule.ts` keeps `defineRule` and the status shape together.

Rejected items (considered, deliberately not changed):

- The three "flag a non-empty object setting for manual review" rules
  (`dependency-overrides.ts`, `named-registries.ts`, `patched-dependencies.ts`)
  share a shape (read key -> `isNonEmptyObject` -> manual violation). A
  `reviewConfigKey` builder would cover only those three: `audit-suppression.ts`
  reads an array plus a second key, `store-server.ts` tests `value !== true`, and
  the messages, keys and docs all differ. The explicit `check` bodies read more
  directly than a spec object, and the new abstraction is not obviously cheaper
  than the duplication it would remove.
- Violation literals order their keys differently across rules (for example
  `dependency-overrides.ts` and `audit-suppression.ts` lead with `actual`, while
  others lead with `remediation`). The order is immaterial to readers and to
  output, since `evaluate-binding.ts` assembles findings in a fixed order.
- `defineRule` is an identity function, but it is kept because it preserves the
  literal `Id` through the `const` type parameter; a plain object literal would
  widen `rule.id` and lose the id union used by reporters and filters.

Actions: none (documentation only). No code commits.

Next candidate directions:

1. Performance and allocations on hot paths (`evaluateBinding` context spread,
   per-(rule,target) project-type resolution in `runLint`) — measure first; the
   shape is already O(rules × targets) and the spread is deliberate isolation.
2. Hand-written tooling (`scripts/*.mjs`, `scripts/pnpm-command.ts`, `bench/*`,
   `bin-wrapper.mjs`) for naming and control flow, since the loop has focused on
   `src` so far.
3. Comment value across `src` and the hand-written docs: confirm each WHY still
   matches the code it explains after the 0.7.x changes.

## 2026-10-16T00:07Z — config loading and validation; CLI limit help

Direction: config loading and validation (`src/core/parse-siro-config.ts`,
`parse-config-file.ts`, `apply-config.ts`, `config-files.ts`, `load-config.ts`,
`inspection-options.ts`, `contracts/config-value.ts`, `config-codec.ts`,
`config-file-ref.ts`, `records.ts`, `adapters/codecs/*`), with a secondary sweep
across contracts, rules, reporters and adapters, then CLI help presentation
(`src/cli/limit-options.ts`, `help.ts`).

Findings:

- Config loading and validation is clean. Codec selection is one
  `satisfies Record<CodecKind, ConfigCodec>` table; `createCodecFor` memoizes the
  bounded wrappers per scan; `createConfigParser` memoizes `(kind, path)` reads
  and deliberately does not cache failures; `parseConfigObject` copies own keys
  (prototype safety) and routes valibot issues through one `formatIssues`;
  `applyConfig` names duplicate and unknown ids before selecting active rules.
  The WHY comments (record() own-key drops, inherited config values, execution
  trust) match the code they explain. No change warranted.
- CLI limit help: `LimitOption.descriptionColumn` had a single override
  (`maxTotalBytes: 25`) that pushed that row's description one column past the
  rest of the generated block, with no effect on any other row. Removed the
  field; `limitHelp` now pads every label to one column, so the short limit
  descriptions align with each other and with the established help column.

Actions:

- `a2e0cbc` refactor(cli): align the limit help descriptions.

Rejected items (considered, deliberately not changed):

- Generalizing the removed `descriptionColumn` to align every row to the longest
  flag (`--max-directory-depth <n>` = 28) would shift the whole block right.
  Rows above the column (`--max-config-depth`, `--max-output-bytes`) still
  overflow, matching the hand-written `FLAG_LINES` convention of a fixed column;
  widening all rows is a cosmetic sweep beyond the observed defect.
- `parseJsonConfig`'s `scopeOf(id) === 'custom'` reads as "unknown built-in
  rule"; naming the predicate would add an import for one call site already
  documented as the JSON/executable split.
- `pmVersions`' valibot `check(..., isPM)` overlaps `record(picklist(PMS), ...)`
  key validation but supplies a clearer message; removing it would change
  diagnostics for no reader saving.
- `applyConfig` walks `mergedRules` twice (duplicate/unknown ids, then
  selection); folding them into one pass would mix validation with selection and
  not clearly read better.
- `loadExecutableConfig`'s `['.ts', '.mjs', '.js']` repeats the extensions of
  `EXECUTABLE_CONFIG_NAMES`; deriving them adds a map for a three-item check.

Note: `git push` failed repeatedly — the 1Password SSH agent is unavailable
(`communication with agent failed`). Commit `a2e0cbc` (this pass) is local on
`release/v0.7.1`, ahead of `origin` alongside the concurrent core-rules commit.

Next candidate directions:

1. Hand-written tooling (`scripts/*.mjs`, `bin-wrapper.mjs`, `bench/*`) for
   naming and control flow; the loop has focused on `src` so far.
2. Comment value across `src` and the hand-written docs (`docs/json-output.md`,
   `docs/policy-sources.md`): confirm each WHY still matches the 0.7.x code.
3. Architecture/import boundaries: re-check `test/architecture.test.ts` stays in
   sync with the area map after any new source file or dependency edge.

## 2026-10-16T00:17Z — hand-written tooling

Direction: hand-written tooling (`scripts/*.mjs`, `scripts/pnpm-command.ts`,
`scripts/docs.ts`, `bin-wrapper.mjs`, `bench/*`) for naming and control flow, with a
secondary sweep over `.githooks/*`, `.github/workflows/*` and the hand-written docs
(`README.md`, `docs/configuration.md`, `docs/policy-sources.md`,
`docs/json-output.md`, `docs/threat-model.md`, `docs/contributing.md`,
`docs/getting-started.md`).

Findings:

- `scripts/` and `bench/` are clean in control flow. `check-release.mjs` validates
  and hashes one byte snapshot; `security-audit.mjs` keeps one `audit` helper whose
  0/1/2 exit mapping and optional-ENOENT skip are documented and whose pnpm/OSV
  parsers share the `{ total, lines }` shape; `verify-package.mjs` names each phase
  (`packTarball`, `installPackage`, `verifyInstalledCli`, ...) and isolates the two
  shell-launch probes behind WHY comments; `docs.ts` renders every rule from one
  registry and `pnpm-command.ts` is a small pure function; `bin-wrapper.mjs` is
  self-evident.
- `bench/fixtures.ts` mixed naming for peer values: `SMALL`/`MEDIUM`/
  `WORKSPACE_MANIFEST` were SCREAMING_CASE while `publication`/`independent`/
  `excluded` were camelCase, implying a category split that does not exist (the
  numeric `*_COUNT` constants legitimately stay SCREAMING). Renamed the three
  fixture values to `small`/`medium`/`workspaceManifest`, matching the other
  fixtures and the derived-value names (`tree`, `packageFiles`) in the same file.
- The hand-written docs still match the code: the limits table mirrors
  `DEFAULT_SCAN_LIMITS`, and `rejectSymlinks`, exit codes, reporter names, config
  fields and release-age units all agree with `src`. No drift found.

Actions:

- `d9ddb1b` refactor(bench): align the fixture value names.

Rejected items (considered, deliberately not changed):

- `parsePnpm`'s `Math.max(total, lines.length)` reconciles the metadata severity
  count with the advisory list. The existing header comment already scopes the
  pnpm-10 advisory representation, and inventing a WHY for a defensive max would
  describe a case the tests never exercise.
- Fixture object key order varies (interface order is name/files/options/
  expectedScope). Reordering all six would be churn beyond the observed naming
  defect; the values in `export const fixtures` now read consistently.
- `const count = vb.pipe(vb.number(), ...)` in `security-audit.mjs` names a
  validator, not a number. It reads correctly where it is destructured into the
  severity fields; renaming touches six schema fields for no reader saving.
- `output` in `verify-package.mjs` is a `--output` path; `outputPath` would be
  marginally clearer but it sits next to `inputTarball` and is used twice.
- Repeated timeout/maxBuffer literals across the scripts, and
  `['.ts', '.mjs', '.js']` repeating `EXECUTABLE_CONFIG_NAMES`, were already
  rejected in earlier passes.

Note: `git push` succeeded this pass; `release/v0.7.1` is back in sync with
`origin` (the prior pass's 1Password SSH failure is resolved).

Next candidate directions:

1. Performance and allocations on hot paths (`evaluateBinding` context spread,
   per-(rule,target) project-type resolution in `runLint`) — measure first; the
   loop has deferred this several times.
2. Adapters (filesystem, codecs, reporters) as the primary direction — swept only
   secondarily so far; look at `createBoundedCodec` vs the `CODECS` table and
   `nodeFileSystem`'s per-call construction.
3. Security boundaries (paths, symlinks, escaping): re-check `safeText`/
   `safeJsonText` control ranges and the `normalizeScopePath` host-vs-portable
   split against the threat-model claims.

## 2026-10-16T00:23Z — adapters (filesystem, codecs, reporters)

Direction: adapters as the primary direction (`src/adapters/*` — codecs
`ini/json/toml/yaml/store`, `exclusions`, `node-errors`, `node-file-system`,
`node-io`, `node-paths`, `node-version`, `repo-context`, reporters
`bounded-json/github/json/pretty/registry`, `safe-text`) together with their
suites (`test/adapters/**`), then a second direction over the core pipeline
helpers the loop had not yet covered (`manifest-checks`, `decide-severity`,
`rebase-finding`, `render-version-note`, `signals`, `pm-versions`,
`detect-pms`, `resolve-pms`, `bounded-file-system`, `config-files`,
`resolve-project-type`, `inspection-options`, `parse-config-file`,
`evaluate-binding`, `run-lint`, `apply-config`, `parse-siro-config`,
`load-config`, `runtime`, `src/index.ts`, `contracts/*`).

Findings: both directions clean. No high-value, low-risk readability change was
warranted.

- Codecs: each `parse` returns `toParsedConfig(...)` from one decode helper that
  converts parser exceptions to constant `ConfigParseError` messages (no source
  excerpts). `createBoundedCodec` documents why only json/yaml delegate depth to
  their parsers, and `createCodecFor` memoizes per scan without caching contents.
- Filesystem: `createStrictPathChecker`, `statRegularFile` and `openInputFile`
  separate the strict-path guard, the regular-file check and the open; the
  NONBLOCK/NOFOLLOW and re-`fstat` comments state the raced-file constraints.
  `nodeFileSystem` documents the per-operation budgets.
- Reporters: `boundedJson` boxes primitive BigInts, applies `toJSON` once and
  tracks active containers with WHY comments matching native JSON; `pretty`
  re-reads NO_COLOR/FORCE_COLOR per call; `github` states why `escapeData` is not
  `safeText`; `safeText`/`safeJsonText` escape ranges are narrower in JSON for a
  stated reason; `registry` derives the name union from `BUILTINS`.
- Core helpers: guard chains read as their policy sentence (`resolve-pms`,
  `inspection-options`, `resolve-project-type`), `PM_SIGNALS`/`detect-pms` keep
  detection evidence in one table, and `decide-severity`/`render-version-note`
  stay one-line declarative.

Rejected items (considered, deliberately not changed):

- `pretty.ts` budgets `line\n` for every collected line, while
  `lines.join('\n')` plus the sink's trailing newline emits `N-1` newlines. The
  overcount is conservative (never truncates a valid report) and the
  `lint-command` wrapper already enforces the exact byte budget; matching them
  would add state for a sub-line difference.
- `nodePaths.resolve` re-checks "escapes repository root" after the lexical `..`
  guard already makes it unreachable. It is cheap defense at a security
  boundary; removing it is not a readability win worth the risk.
- `rebase-finding.ts` destructures `[first, ...rest]` before mapping to preserve
  the non-empty tuple type of `Remediation.operations` (`map` widens to an
  array). The idiom is compact and correct; a comment would restate the types.
- `safeJsonText` omits the C0 range and the leading-`::` guard that `safeText`
  has: `JSON.stringify` escapes in-string controls, and structural newlines in
  JSON never start a line at `::`. The comment already scopes this.
- Escaping brackets/backslashes in `exclusions.ts` versus rejecting `\` for
  `exclude` in `inspection-options.ts` is not duplication: the adapter is the
  lower-level matcher its own test drives directly, and the strict check lives
  at the user-input boundary. Both are correct in scope.
- `render-version-note.ts` uses `typeof x !== 'undefined'`; stylistic, already
  rejected in an earlier pass.
- `loadExecutableConfig`'s `['.ts', '.mjs', '.js']` and the manifest filename
  union remain unshared (rejected earlier); `nodeFileSystem`'s per-call
  construction is deliberate per-operation budgeting, not an oversight.

Actions: none (documentation only). No code commits.

Next candidate directions:

1. Determinism, timezone and platform behavior as the primary direction
   (`minimum-release-age.ts`, `deno-release-age.ts`, `contracts/date-time.ts`,
   the `node-paths.ts` Windows/POSIX split) — never reviewed as a primary focus.
2. Performance and allocations on hot paths (`evaluateBinding` context spread,
   per-(rule,target) project-type resolution in `runLint`) — measure first; the
   loop has deferred this repeatedly.
3. Docs prose and examples as the primary direction (`docs/configuration.md`,
   `docs/json-output.md`, `docs/policy-sources.md`, `docs/getting-started.md`):
   reader-facing clarity rather than code drift.
