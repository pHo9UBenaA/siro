# Observations log

> Append-only record of sub-finding observations from `/review` rounds and
> spot-checks. Captures the "worth a future eye" notes that did NOT meet
> the must-fix / discuss bar of their axis — smell-level concerns,
> quality observations outside any axis's threshold, "I would write it
> differently but defensible as-is" calls.
>
> **Why this exists.** The axis-isolated, reproducer-required review
> loop is deliberately conservative: it drops findings without a
> reproducer (R08), speculative API shape (R06), naming aesthetics
> (R09), JSDoc additions (R10), and several other "I noticed
> something" patterns. That gives convergence, but it also means
> useful observations evaporate the moment the round finishes. This
> file is where they accumulate instead.
>
> **Append-only.** Entries are NEVER removed by future rounds. Even
> after the underlying code changes, the historical observation
> stays — the trail of what reviewers thought at the time has value
> independent of whether it still applies. The maintainer may
> promote an entry into `DECISIONS.md` / `REJECTED.md` or a real
> finding later; the original entry here is not deleted.
>
> **Format.** `## YYYY-MM-DD — <axis-or-source> — <stable-slug>`
> Each entry: 1–3 sentences explaining what caught the reviewer's
> eye, optionally with a `file:line` reference. Source tag is the
> axis name when emitted by an axis reviewer, or `spot-check` when
> emitted by the maintainer's manual sweep, or `<agent-name>` for
> other origins.

---

## 2026-06-08 — spot-check — bindingvisit-parsed-field-unread-by-production

`src/domain/services/evaluate-bindings.ts:21` — `BindingVisit.parsed` is
populated by `evaluateBindings` but neither production consumer destructures
it: `src/application/run-lint.ts:21` and
`src/application/commands/init.ts:95` both omit `parsed` from the visitor's
parameter list. `init.ts` independently calls `parseConfig(ctx, op.file)`
inside the visitor and benefits from the shared memo cache, so removing the
field wouldn't lose the cache hit. The field's only reader is a unit test
pinning the contract — a textbook "exported for the test, not for callers"
shape. Worth a dead-code pass.

## 2026-06-08 — spot-check — planassignments-uses-reference-equality-for-config-values

`src/application/commands/init.ts:217` — the "already-set" check
`getByPath(parsed, a.keyPath) !== a.value` relies on JS reference / value
equality. `ConfigValue` is `string | number | boolean` (primitive), so
`===` works for the assignment side. But `getByPath` may return
`null`, an array, or a nested `ParsedConfig` object when the user's
file has the wrong shape at that path — and any of those will compare
unequal to a primitive, triggering a write that the codec then has to
normalize. Not a defect today (the codec write is idempotent and the
ParsedConfig path implies the user intentionally nested), but a stronger
"already compliant" check would normalise both sides before comparing.

## 2026-06-08 — spot-check — cli-version-detection-does-not-respect-double-dash

`src/cli.ts:92` — `argv.includes('--version')` scans the entire argv,
including tokens after `--`. By contrast `detectHelpFlag` at line 67–69
explicitly `break`s on `--` so `siro lint -- --help` does NOT trigger
the help path. The asymmetry means `siro lint -- --version` (the user
passing literal `--version` through to a wrapped tool) would still print
the siro version. Niche, but the inconsistency is the kind of thing a
correctness-axis reproducer can't cover (cac handles passthrough first,
so the practical impact depends on argv parsing order).

## 2026-06-08 — spot-check — line-merge-normalises-mixed-eol-on-write

`src/adapters/codecs/_merge.ts:28-29` — `eol` is decided by "does the
file contain ANY `\r\n`?", then the whole buffer is normalised to `\n`
and re-joined with the detected EOL. A file with mixed line endings
gets rewritten in a single style on the first merge. The TOML / INI
codecs share this path. Round-trip property tests cover the
single-EOL case; mixed-EOL is unlikely in practice and the normalisation
is arguably an improvement, but it is a silent transformation worth
documenting if a user ever reports "init changed lines I didn't expect".

## 2026-06-08 — spot-check — config-loader-double-resolves-cwd

`src/adapters/config-loader.ts:50` — `createJiti(resolve(cwd), …)`
calls `node:path.resolve` on a value that is already an `AbsPath`
(branded in `src/cli.ts:129` via `asAbsPath(resolve(positionalCwd ?? process.cwd()))`).
The brand exists precisely to certify "this string is already
resolved"; re-resolving is a no-op but it suggests the `AbsPath` brand's
guarantee isn't being trusted here.

## 2026-06-08 — spot-check — reporter-resolves-to-undefined-with-object-arg

`src/application/commands/lint.ts:80-91` — `resolveReporter` returns
`undefined` only when a _string_ name doesn't match anything in the
registry; if the embedder passes a fully-formed `Reporter` object as
`options.reporter`, it is returned verbatim without registry consultation.
That's intentional (programmatic embedders shouldn't need to register
first), but it means the `Unknown reporter: …` UsageError message at
line 56 will never fire for object-shaped reporters — including
malformed objects. If a JS embedder passes `{ name: 'foo' }` without a
`format` function, the failure surfaces later at call time, not at the
boundary. Not a defect, but a boundary-asymmetry note.

## 2026-06-08 — spot-check — pin-exact-versions-regex-could-be-stricter

`src/domain/rules/pin-exact-versions.ts:54` — the deno-imports
range-detector uses `/[\^~]|>=|<=|<|>|\|\||\s/`. The character class
`[\^~]` matches `^` and `~` (correct). The `>=`, `<=` precede `<`, `>`
so alternation order is correct. The `\s` catches whitespace, picking
up `1.0.0 || 2.0.0` after the `||`. The check is permissive
(`a@1.0.0-beta` is treated as exact even though `-` could be a range
in npm semver-ish contexts) but the rule docs are explicit about this
being best-effort. No fix needed; recording so a future "tighten the
regex" suggestion has the prior trade-off written down.

## 2026-06-08 — spot-check — empty-readtext-and-codec-empty-string-parse

`src/domain/services/parse-config-file.ts:55` — when
`ctx.readText(path)` returns `undefined` (file absent), `raw` becomes
`''` and the codec's `parse('')` is invoked. Every codec needs to
return `{}` (or its empty-equivalent) for the empty string; the
property tests cover this for `_merge` but not all parsers'
`parse('')` paths have an explicit assertion. A targeted "parse of
empty string returns empty parsed view" sync-guard test per codec
would lock the contract.

## 2026-06-08 — spot-check — review-axis-skips-quality-without-reproducer

`docs/review/AXES.md` + axis prompts — the review loop is structurally
biased to drop:

- "could be clearer" (no axis to absorb readability)
- "this allocation in a loop adds up" without a bench delta (`perf-hotspot` axis §5 requires bench evidence)
- "this exported field is only used by tests" (axis is `dead-code` and only fires from knip output, which doesn't flag struct fields)
- "this validation duplicates a static guarantee" (R08 territory)

Result: quality observations that an open-loop reviewer would surface
("the `findings` array isn't sorted; reporter output ordering is loop
-induced") cannot land. That's the design — but it does mean the
observations log is the only place these accumulate. Calibrate
expectations accordingly: zero findings on an axis ≠ zero notes worth
keeping.

## 2026-06-09 — docs-sync — readme-config-file-list-omits-aube

The feature bullet at lines 23-30 and the comparison-vs-npm-audit table at line 76 enumerate the static-analysis target files (.npmrc, pnpm-workspace.yaml, .yarnrc.yml, bunfig.toml, deno.json, package.json) without mentioning aube-workspace.yaml / aube-lock.yaml, even though aube is listed as a first-class supported PM in line 3 and --pm accepts it. Not user-breaking (aube users still discover support via the PM list and --pm), but the file enumeration is internally inconsistent with the rest of the README.

`README.md:26`

## 2026-06-09 — docs-sync — version-matrix-publish-access-rows-incomplete

The publish-access table lists only npm and pnpm rows, but the rule applies to npm/pnpm/yarn/bun/aube per the registry (and rules.md / comparison.md). Similarly the files-field table collapses to one npm/pnpm/yarn/bun row and omits deno and aube even though both have bindings. These are tracked as 'TBD' work elsewhere in the file, so the omission is internal-checklist rather than user-visible drift, but the rows could be added with explicit TBD / n/a cells to keep coverage symmetric with the registry.

`docs/version-matrix.md:92`

## 2026-06-09 — docs-sync — version-matrix-provenance-aube-row-without-binding

The provenance table has an aube row marked TBD, but src/domain/rules/provenance.ts has no aube binding and comparison.md shows aube as '—' for provenance. The TBD cell is harmless (the file's own conventions say not to quote TBD cells in versionNote), but the row implies an aube binding is in scope when the rule file explicitly notes 'aube: no upstream attestation pipeline yet' — either delete the row or annotate it as n/a.

`docs/version-matrix.md:90`

## 2026-06-09 — tdd-discipline — tdd-canon-v2-entries-resolved

TDD-CANON V2 entries (test/scripts/rule-scaffolder.test.ts:245,251) have been resolved — the file no longer contains any readFileSync references to src/. The canon's 'observed deviations' section can prune V2 in a docs(tdd-canon): refresh observed deviations commit.

`docs/review/TDD-CANON.md`

## 2026-06-09 — tdd-discipline — tdd-canon-v3-mischaracterised-per-file-vs-per-it

TDD-CANON V3 enumerates four files with elevated toMatchObject counts (aube-bindings, require-config-key, bun-bindings, deno-bindings). On inspection each it contains at most one toMatchObject — the elevated count is per-file, not per-it. The canon step-2 anti-pattern (stacked AAA inside one it) is not present. Consider pruning V3 from the observed-deviations section or reframing it as 'high matchObject count per file is a yellow flag, confirm distribution before flagging'.

`docs/review/TDD-CANON.md`

## 2026-06-09 — comment-rot — pin-exact-versions-hasrange-bullet-list-narrates-impl

Function-head block on hasSemverRangeOperator. The bullet list (lines 30-38) enumerating the suffix cases is design narrative bordering on C5 (mirrors what the regex/parsing code does just below). The final paragraph (39-43) is the WHY-NOT for treating bare-no-@version specifiers as compliant. If the bullet list ever drifts from the implementation it should be cut to just the final paragraph; today it does not contradict the code.

`src/domain/rules/pin-exact-versions.ts:25-44`

## 2026-06-09 — comment-rot — detect-pms-block-narrates-body-with-thin-why-not

Function-head block on detectPMs. The 1)/2) ordering and the return-contract sentences narrate the body. The only WHY-NOT is the closing 'embedders can swap in a virtual FS without touching the real disk' justifying the ctx parameter. If a future refactor stops carrying signals via ctx, the rest of this block will rot first.

`src/domain/services/detect-pms.ts:37-46`

## 2026-06-09 — comment-rot — merge-programmatic-rules-c7-historical-narration

Strong WHY-NOT in the first paragraph (explicit collision surfacing). Second paragraph 'previously this lived inline in lintCommand, forcing initCommand to either reimplement it (drift) or skip programmatic rules entirely' is C7-adjacent historical narration that will lose relevance once everyone forgets the pre-refactor shape. Worth shedding next time this file is touched.

`src/domain/services/merge-programmatic-rules.ts:4-16`

## 2026-06-09 — comment-rot — script-runtime-header-c7-historical-narration

Header block contains WHY-NOT (the underscore prefix sorts it ahead of the per-context dirs is a hidden invariant) but also 'previously left gen-version with no error handling while gen-rule rolled its own fail() helper' — historical narrative that rots once the original drift is forgotten. Borderline today.

`scripts/_shared/script-runtime.mjs:1-35`

## 2026-06-09 — tdd-discipline — tdd-canon-v1-no-live-regressions-since-establish-commit

CANON V1 ('test:' commits without paired 'src/') has no live regressions: every 'test:' commit in the last 30 days predates the canon establishment commit (0202de6c, 2026-06-08 18:37); since then, test-only changes have correctly carried 'refactor(test):' or 'chore(test):' prefixes.

`docs/review/TDD-CANON.md`

## 2026-06-09 — tdd-discipline — tdd-canon-v2-resolved-confirmed-r2

CANON V2 (rule-scaffolder source-shape pins at lines 245/251) was resolved by 9bcb6ed5 — the file is now 224 lines with no 'readFileSync' against 'src/' (readsRealSource:false in inventory). Recurrence of the R1 observation: V2 still listed in TDD-CANON observed-deviations.

`docs/review/TDD-CANON.md`

## 2026-06-09 — tdd-discipline — tdd-canon-v4-resolved-no-live-regressions

CANON V4 (module-top mutable 'ctx') was resolved by 63783e3e — deno-bindings.test.ts:8, minimum-release-age.test.ts:10, pin-exact-versions.test.ts:6 now all declare 'ctx' inside 'describe' blocks, matching D09. The V4 entry in TDD-CANON.md remains as a named anti-pattern; no live regressions detected.

`docs/review/TDD-CANON.md`

## 2026-06-09 — tdd-discipline — v3-candidate-flag-conflates-per-file-with-per-it

Inventory flagged 'test/domain/rules/builders/require-config-key.test.ts' and 'test/domain/rules/bun-bindings.test.ts' / 'test/domain/rules/deno-bindings.test.ts' as V3-candidates by raw matcher count, but their 'toMatchObject' calls are distributed across distinct 'it' blocks — one matcher per arrange-act — so no canon step 2 violation applies. The flag is a count-density signal, not a distribution one; consider extending the inventory script to compute per-it matcher density.

`scripts/review/lib/test-inventory.ts`

## 2026-06-09 — docs-sync — version-suffix-example-uses-nonexistent-version-pair

README and docs/configuration.md illustrate the versionNote suffix with `(available since pnpm 9.6.0; default safe since pnpm 11.0.0)`, but no current rule emits that pair — the closest real binding (`disable-lifecycle-scripts × pnpm`) declares `configAvailableSince: 'pnpm 10.3.0'`. The text is clearly illustrative rather than a contract, so it is below the docs-sync P-bar; flagging only because using a real (rule, suffix) pair would let readers grep for it in source.

`README.md:48`

## 2026-06-09 — docs-sync — configuration-detection-list-omits-alternate-lockfiles

The PM-detection lockfile list enumerates the canonical name per PM but omits `bun.lockb` and `npm-shrinkwrap.json`, which `src/domain/entities/signals.ts` still treats as valid signals. Omission of alternate/legacy filenames is plausibly intentional (docs default to the modern shape), but a future reader debugging why a `npm-shrinkwrap.json`-only repo got auto-detected would not find the answer in this doc.

`docs/configuration.md:31`

## 2026-06-09 — docs-sync — readme-features-config-file-list-omits-package-json-and-aube

The README Features bullet enumerates `.npmrc`, `pnpm-workspace.yaml`, `.yarnrc.yml`, `bunfig.toml`, `deno.json` as the surfaces siro maps rules onto, but `package.json` (used by `files-field`, `publish-access`) and `aube-workspace.yaml` (used by aube bindings) are also load-bearing target files in the registry. This is prose, not the comparison matrix, so it is below the docs-sync P-bar — but a reader asking 'does siro touch package.json?' would conclude no.

`README.md:26`

## 2026-06-09 — perf-hotspot — monorepo-fixture-siblings-currently-inert

The monorepo fixture builds 50 sibling package.json files but `fixtures.ts` itself documents that `siro does not walk workspace packages yet`, so today only the `pnpm-workspace.yaml` line-count contributes to measured ms/op; the per-sibling files are amortised memfs build cost outside the timed window (lint.bench.ts reuses one volume). The fixture is sound under its current comment, but if workspace traversal lands and the row's ms/op jumps, do not attribute it to a regression without re-baselining — the fixture was sized for a future workload.

`bench/fixtures.ts:58-87`

## 2026-06-09 — perf-hotspot — no-baseline-recorded-in-decisions

The axis brief (perf-hotspot.md §Baseline location) requires the current baseline to live in DECISIONS.md, but D06 only records that the harness exists; no row-level ops/sec or ms/op numbers are pinned. Until a baseline lands, any future perf-hotspot finding on `lint` or `init` rows is structurally `establish a baseline` rather than `regression vs. baseline` — the harness output cannot be compared to anything but its previous-run shell history.

`docs/review/DECISIONS.md`

## 2026-06-09 — dead-code — checkstatus-na-reason-never-constructed

The optional `reason?: string` field on the `CheckStatus` `state: 'na'` arm is never constructed by any binding (all four `state: 'na'` emit sites in `src/domain/rules/{files-field.ts,publish-access.ts,builders/require-config-key.ts}` omit it) and never read anywhere in src/, test/, or scripts/. Union arm could be simplified to `{ readonly state: 'na' }` with no behavioural change. Not elevated to a finding because knip is clean and the axis explicitly excludes 'could be simpler' suggestions — but worth noting if a future round revisits the rule entities surface.

`src/domain/entities/rule.ts:41`

## 2026-06-09 — dead-code — merge-result-changed-only-read-by-tests

`MergeResult.changed` is set by every codec's `applyMerge` (json/yaml/ini/toml) and tracked internally to drive `joinLineBuffer`, but no `src/` consumer ever reads the returned `.changed` flag — `init.ts:221` destructures only `{ text }`. The only observers are codec tests (ini.test.ts:53, toml.test.ts:89/95, codecs.property.test.ts:104) that pin the round-trip contract. Because `MergeResult` is reachable through the public `ConfigCodec` port (re-exported from `src/index.ts`), simplifying it to `{ text: string }` is a port-shape change rather than a pure deletion.

`src/domain/entities/config-value.ts:27`

## 2026-06-09 — tdd-discipline — post-canon-test-prefix-slip-2026-06-08

Three commits with subjects 'test: inline makeCtx()…', 'test(evaluate-bindings): drop the stacked…', and 'test(rule-scaffolder): remove the R01 source-shape pin…' landed at 2026-06-08 18:37, roughly one minute after the TDD canon and D11 were committed (18:36). Each touches only test/ files (no paired src/ change) so under D11 they should carry chore(test): or refactor(test):. R11 forbids retroactive rewriting; this is a forward-looking signal that the policy needs reinforcement at commit-message time.

## 2026-06-09 — tdd-discipline — ctx-helper-let-binding-vs-describe-const-mixed

Two describe blocks each declare `const ctx = makeCtx()` at the describe top. The pattern is canon-compliant (per-describe, not module-top, satisfies D09) but differs from the sibling 'inline `ctx()` per assertion' style used in aube-bindings / bun-bindings / pnpm-bindings since 63783e3. Not a finding — RepoContext is read-only and the canon does not require one style — but the inconsistency may surface again whenever someone copy-pastes from the wrong sibling.

`test/domain/rules/deno-bindings.test.ts:8`

## 2026-06-09 — tdd-discipline — canon-v3-helper-note-stale

TDD-CANON V3 lists test/helpers/binding-expectations.ts as having 4 stacked toMatchObject occurrences, but the helper was refactored (commit 419e7cc) to use toContain/toBe/not.toMatch and now contains a single toMatchObject paired with an explicit state guard — not stacking. Maintainer may prune the helper line from V3 on the next docs(tdd-canon): refresh sweep.

`docs/review/TDD-CANON.md`

## 2026-06-09 — tdd-discipline — canon-v3-binding-file-counts-not-stacked

The V3-candidate flag (matchObject>=4) fires on require-config-key (8), bun-bindings (6), aube-bindings (4), deno-bindings (4), but inspection shows each toMatchObject sits alone in its own it() block — high file-level count reflects many distinct behaviours of versionNote rendering, not stacked shape pins within one arrange-act-assert. The inventory's V3-candidate flag is per-file rather than per-it; canon's S3 only fires when stacked inside one it.

`test/domain/rules/builders/require-config-key.test.ts`

## 2026-06-09 — tdd-discipline — v4-resolved-status-noted-in-canon

Axis brief S4 still lists three module-top-ctx sites (minimum-release-age:9, deno-bindings:7, pin-exact-versions:5) as known violations; current source has the ctx declaration inside the describe block in all three (canon V4 already marks this resolved). Axis brief .claude/agents/axes/tdd-discipline.md S4 paragraph could drop the stale line:column references on the next docs sweep.

`.claude/agents/axes/tdd-discipline.md`

## 2026-06-09 — comment-rot — pin-exact-versions-algorithm-walkthrough

The hasSemverRange JSDoc spends ~10 of its 20 lines restating the if/else cases the code shows literally. The final paragraph carries a real WHY-NOT (latest-style imports left compliant by design), so the block is not a delete candidate today; revisit if the algorithm grows or the restatement falls out of sync with the code.

`src/domain/rules/pin-exact-versions.ts:25-44`

## 2026-06-09 — comment-rot — detect-pms-function-head-narrative

detectPMs's function-head comment is mostly signature restatement (steps 1+2 mirror the function body, the ctx paragraph duplicates the RepoContext type). The one rationale sentence ('embedders can swap in a virtual FS') would be enough on its own. Not promoted to a finding because the trade-off sentence justifies keeping the block; flag if the algorithm summary drifts from the code.

`src/domain/services/detect-pms.ts:37-46`

## 2026-06-09 — comment-rot — rule-coverage-notes-pattern

Four rule files use the 'Coverage notes:' bullet pattern to record per-PM N/A reasoning and documentedDefault semantics. Each individual block encodes real WHY-NOT (why a PM is N/A, why documentedDefault is/isn't used), but the repeated style means future drift between the bullet text and the bindings object below it would be invisible. Worth a periodic audit, not a finding.

`src/domain/rules/frozen-lockfile.ts`

## 2026-06-09 — comment-rot — siro-config-public-example-borderline

Block is a pure WHAT-style usage example (no WHY-NOT), but `SiroConfig`/`defineConfig` are re-exported from `src/index.ts` and the example feeds the public API surface — C6 exception applies, so kept this round. Revisit if the public surface stops exposing `SiroConfig` directly, at which point the example loses its TypeDoc justification and becomes signature restatement.

`src/domain/entities/siro-config.ts:9-18`

## 2026-06-09 — comment-rot — pin-exact-versions-helper-algorithm-narrative-r2

Block mostly narrates the parsing algorithm (case-by-case branching the next reader could derive from the code), with one trailing WHY-NOT about not treating bare specifiers as violations. Borderline C5. If the algorithm changes, the bulleted case list will rot first; consider collapsing to just the trailing WHY-NOT sentence then. (R2 recurrence of R1 same-file observation.)

`src/domain/rules/pin-exact-versions.ts:25-44`

## 2026-06-09 — comment-rot — detect-pms-design-narrative-r2

Function-head block is mostly design narrative (the strongest-signal-first ordering and the ctx-injection rationale). The `ctx`-injection rationale is genuine WHY-NOT for embedders; the ordering recap is borderline restatement. (R2 recurrence of R1 same-file observation.)

`src/domain/services/detect-pms.ts:37-46`

## 2026-06-09 — comment-rot — script-runtime-module-header-narrative

Module-level block mixes a real WHY-NOT (layout-aware root resolution avoids per-driver edits) with two paragraphs of design narrative (`Every driver reaches for the same trio…` and the underscore-prefix sort note). Borderline C5; the underscore-prefix paragraph would naturally rot if scripts/ layout changes.

`scripts/_shared/script-runtime.mjs:1-35`

## 2026-06-09 — correctness — ini-array-values-collapsed-to-empty-object

iniCodec.parse routes every object-typed entry through toParsedConfig, which returns {} for arrays — so a key like `noproxy[]=a / noproxy[]=b` in .npmrc (legal npmrc syntax) is silently flattened to {} on read. No builtin rule inspects an array-valued .npmrc key today, so the data loss is invisible, but a future customRule that reads such a key would see an empty object instead of the array the user wrote.

`src/adapters/codecs/ini.ts:33`

## 2026-06-09 — correctness — toml-inline-comment-lost-when-string-contains-escaped-quote

inlineCommentFor walks the line with quote-state tracking but treats `\"` as quote toggles (no escape handling), so on a TOML line like `scanner = "a\"b"  # keep this` the scanner ends with inDouble=true and returns undefined — when a future customRule rewrites that key the trailing comment is dropped. Builtin rules write only booleans/numbers and never see this path; flagged as a latent edge case rather than a live defect.

`src/adapters/codecs/toml.ts:234`

## 2026-06-09 — correctness — joinlinebuffer-empty-input-gains-trailing-newline

For `existing === ''`, `toLineBuffer` sets `hadTrailingNewline = true`, so `joinLineBuffer({lines:[]}, false)` returns `'
'` rather than `''`. No current call site exercises this (empty inputs always come paired with at least one assignment), but a future caller that calls `applyMerge('', [])` would silently gain a newline.

`src/adapters/codecs/_merge.ts:42`

## 2026-06-09 — correctness — documenteddefault-bypasses-extraFix-check

`requireConfigKey`'s `check` runs `checkDocumentedDefault` before `checkExtraFixes`, so when the primary key is unset and a documented default satisfies it, any missing `extraFix` entries are not validated. No current rule combines `documentedDefault` with `extraFix` (only npm's `pin-exact-versions` uses `extraFix`, and it has no `documentedDefault`), but the contract 'extras must be valued the same as the auto-fix would write them' is silently broken if a future rule pairs the two.

`src/domain/rules/builders/require-config-key.ts:212`

## 2026-06-09 — correctness — toml-inline-comment-scanner-ignores-string-escapes-r2

(R2 recurrence) `inlineCommentFor` toggles `inDouble`/`inSingle` on every quote without honouring TOML basic-string escapes (`\"`). Built-in rules only write booleans/numbers; the path is reachable only by an embedder customRule that rewrites a quoted-with-escaped-quote string value AND a real inline comment past it — narrow but lossy. Reviewer noted same observation in R1 (toml-inline-comment-lost-when-string-contains-escaped-quote); recurrence kept per OBSERVATIONS rule 3 (no dedup against prior entries).

`src/adapters/codecs/toml.ts:234`

## 2026-06-09 — architecture-drift — cac-help-string-bypasses-reporter-ssot

The cac --reporter option description hard-codes the literal 'pretty|json|github' while BUILTIN_REPORTER_NAMES exists in src/adapters/reporters/registry.ts and is consumed by src/cli/help.ts. The string is currently dead text (renderHelp intercepts --help before cac's own help can fire at src/cli.ts:102-105), so it is not user-visible drift today. If the help-interception path is ever removed or bypassed, this literal would silently lag behind the registry. Worth watching, not a P1 — there is no current consumer.

`src/cli.ts:113`

## 2026-06-09 — architecture-drift — config-loader-bakes-default-adapter

loadConfig and createRepoContext both default their FileSystem parameter to the concrete nodeFileSystem from a peer adapter file. This is intra-adapter DI shorthand and the override path is preserved, so it does not constitute an adapter-to-adapter coupling violation. Flagging because if a third adapter ever needs to compose these, the implicit default may make injection ordering surprising.

`src/adapters/config-loader.ts:35`

## 2026-06-09 — test-brittleness — aube-bindings-it-block-tests-multiple-behaviours

The `frozen-lockfile on aube: unset → dynamic info` and `minimum-release-age on aube: unset → dynamic info` it blocks each bundle five distinct behaviours (helper-asserted D-2 downgrade, regression to violation when key explicitly weakened, severity absence on regression, ok state on safe value, fix-op shape). A future split would isolate the regression-vs-D-2 contracts cleanly, but every assertion currently pins a real behaviour and a forced split would be R04 territory at one call site each. Leaving as-is.

`test/domain/rules/aube-bindings.test.ts:56`

## 2026-06-09 — test-brittleness — bun-bindings-negative-prose-pins

The `points users at bun 1.2.0` it stacks three negative-shape assertions (`not.toContain('bun 1.3.0')`, `not.toMatch(/introduced the curated allow-list/)`, `not.toMatch(/bun 1\.3\+/)`) on top of one positive `toContain('available since bun 1.2.0')`. Each negative is a regression guard against a known prior copy shape and not strictly an R02 stack of an additional shape on top of a behavioural assertion, but it does pin three variations of the same forbidden phrase. If the prose is rewritten the three negatives will all need to be re-litigated together; reducing to one positive pin would be the cleanup.

`test/domain/rules/bun-bindings.test.ts:92`

## 2026-06-09 — test-brittleness — require-config-key-versionnote-rendering-cases

Eight it blocks each pin one variant of versionNote message composition via a single `toMatchObject({state, message})`. Single-pin-per-it keeps each test honest, but the eight cases are mechanical permutations of (configAvailableSince, defaultSafeSince, note) presence × (regular path, accept path, documentedDefault path). An `it.each` parametrisation would compress without losing coverage; not proposing it as a finding since the current spelling is readable and each branch is a real distinct case.

`test/domain/rules/builders/require-config-key.test.ts:45`

## 2026-06-09 — test-brittleness — documented-default-shape-three-pins

expectDocumentedDefaultDynamicInfo asserts binding.severity undefined, then status.state === 'violation', then toMatchObject({state:'violation', severity:'info'}). The middle and final assertions overlap (state is checked twice); a single toMatchObject({state:'violation', severity:'info'}) plus the severity-undefined guard would carry the same contract. Not promoted: the explicit state guard exists to produce a readable failure (per the in-file comment), and removing it would make a misconfigured-ctx failure cryptic — borderline R02 with a documented reason to keep.

`test/helpers/binding-expectations.ts:18`

## 2026-06-09 — test-brittleness — disable-lifecycle-scripts-pnpm-status-shape-and-severity

Two adjacent `it` blocks pin the (expected, actual) shape of a CheckStatus and then re-pin the documentedDefault demotion against the same binding via two independent toMatchObject calls; the contract is fully covered once between status-shape and the dedicated documentedDefault helper test. Not promoted: the second assertion targets a structurally distinct branch (explicit `false` vs unset) and removing either would leave that branch unchecked.

`test/domain/rules/disable-lifecycle-scripts.test.ts:60`

## 2026-06-11 — comment-rot — zwsp-comment-gate-options-declined

Removed a U+200B between `*` and `/` in scan-long-comments.mjs:83. No automated
re-injection gate was added; the trade-offs were weighed and declined:

- biome `noIrregularWhitespace` is recommended + on and DOES flag U+200B at a
  code position (verified), but it does NOT inspect comment CONTENT (U+00A0 and
  U+200B inside `//` / block comments read clean — verified). The offending ZWSP
  sat inside a `//` comment, so biome cannot catch it (no ESLint
  `skipComments:false` equivalent exists in biome).
- Feeding the scanner's own source to `parseBlocks` would detect re-injection
  but is readsRealSource = R01/V2 (the self-scan anti-pattern); declined.
- A general invisible-char gate is out of scope for this 15-item batch.
- Cheapest third option, NOT taken but recorded so it isn't re-litigated as
  "impossible": an informational preflight gate (e.g. ripgrep for a literal U+200B byte)
  over the repo
  (~3 lines, neither biome nor self-scan). Revisit if ZWSP recurs.

`scripts/review/lib/scan-long-comments.mjs:83`

## 2026-06-11 — correctness — user-extension-throw-bare-70

A throwing user extension (reporter.format or a customRule check/fix) exits 70
with a bare stack and is NOT named: the user cannot tell from the output which
extension threw. We chose (b) -- redefine 70 as "siro bug OR user extension
threw" and verify it -- over (a) wrapping every extension call point in a
ConfigError (exit 2). Rationale: (a) would relabel a legitimate reporter's
transient error as a "config error" and spread a behaviour change across all
binding call sites, beyond this batch's scope. The UX gap (no extension name on
the 70 path) is recorded as a future (a)-style seed, not silently dropped.

`src/cli.ts:305`

## 2026-06-11 — comment-rot — package-json-private-comment-not-rot

A re-review flagged the `private` WHY-NOT comment ("the reverse nesting would
fall back to `true` even when the key is absent") as comment-rot, claiming
v.optional(v.fallback(v.boolean(),true)) and v.fallback(v.optional(v.boolean()),true)
are observationally equivalent. REJECTED: the premise is inverted. Measured in
valibot 1.4.1 inside an object (the real usage, looseObject), an ABSENT key
gives outside={} (undefined) but reverse={private:true} -- the comment's final
sentence is correct. The likely error: testing the bare schema with explicit
`undefined` (where both give undefined) instead of a missing object key. The
comment is left unchanged; no edit made. The independent 'null' arb-filter add
and the D12 generator-constraint amend were still applied.

`src/domain/schemas/package-json.ts:17`

## 2026-06-12 — spot-check — bindingvisit-parsed-field-unread-by-production-withdrawn

**Withdrawn** (2026-06-12): `BindingVisit.parsed` no longer exists — evaluate-bindings.ts removed the field and its JSDoc now documents why visitors call parseConfig themselves.

## 2026-06-12 — spot-check — cli-version-detection-does-not-respect-double-dash-withdrawn

**Withdrawn** (2026-06-12): detectVersionFlag now returns false on `--`, matching detectHelpFlag; the asymmetry this entry flagged has been removed.

## 2026-06-12 — spot-check — config-loader-double-resolves-cwd-withdrawn

**Withdrawn** (2026-06-12): loadConfig now calls createJiti(cwd, ...) directly; the redundant resolve() was removed and the AbsPath brand is trusted (documented inline).

## 2026-06-12 — correctness — toml-inline-comment-lost-when-string-contains-escaped-quote-withdrawn

**Withdrawn** (2026-06-12): inlineCommentFor in toml.ts now skips `\` escapes inside double-quoted runs, so an escaped quote no longer flips the quote state.

## 2026-06-12 — correctness — toml-inline-comment-scanner-ignores-string-escapes-r2-withdrawn

**Withdrawn** (2026-06-12): duplicate of the R1 sighting; resolved by the same escape-handling fix in inlineCommentFor.

## 2026-06-12 — correctness — documenteddefault-bypasses-extraFix-check-withdrawn

**Withdrawn** (2026-06-12): resolved by D15 — require-config-key now evaluates extraFix keys unconditionally after the documentedDefault path, pinned by a synthetic test.

## 2026-06-12 — dead-code — checkstatus-na-reason-never-constructed-withdrawn

**Withdrawn** (2026-06-12): CheckStatus state:na no longer carries an optional reason field — src/domain/entities/rule.ts declares the arm as state:na only.

## 2026-06-12 — spot-check — reporter-resolves-to-undefined-with-object-arg-withdrawn

**Withdrawn** (2026-06-12): resolveReporter in src/application/commands/lint.ts now validates object-shaped reporters with isReporterShape at the boundary, throwing UsageError on a malformed object instead of failing later at format-call time.

## 2026-06-12 — correctness — ini-array-values-collapsed-to-empty-object-withdrawn

**Withdrawn** (2026-06-12): iniCodec.parse now preserves `key[]=` arrays (each element coerced like a top-level scalar) and applyMerge refuses array-key rewrites with a named error — the silent flatten-to-{} this entry flagged no longer exists.

## 2026-06-12 — architecture-drift — cac-help-string-bypasses-reporter-ssot-withdrawn

**Withdrawn** (2026-06-12): cli.ts now interpolates BUILTIN_REPORTER_NAMES into the cac --reporter option description; the hard-coded 'pretty|json|github' literal this entry flagged is gone.

## 2026-06-12 — spot-check — planassignments-uses-reference-equality-for-config-values-withdrawn

**Withdrawn** (2026-06-12): superseded by the D12 leaf-clobber amendment — the comparator intentionally allows replacing the assignment's leaf, so the 'stronger already-compliant check' this entry wanted is no longer desirable.

## 2026-06-12 — spot-check — ini-inline-comment-separator-normalised

extractInlineComment re-attaches a preserved trailing comment with a single-space separator, normalising the author's original gap (tabs / multiple spaces) on rewrite. D12 converges either way; recorded so a future 'init changed my comment alignment' report has the prior trade-off written down.

`src/adapters/codecs/ini.ts`

## 2026-06-13 — spot-check — joinlinebuffer-empty-input-gains-trailing-newline-withdrawn

**Withdrawn** (2026-06-13): toLineBuffer no longer treats the empty string as having a trailing newline — `applyMerge('', [])` now returns `''`; pinned by test/adapters/codecs/merge-empty-input.test.ts.

## 2026-06-13 — dead-code — merge-result-changed-only-read-by-tests-withdrawn

**Withdrawn** (2026-06-13): MergeResult was simplified to `{ text }` before publish — the test-only `changed` flag was removed from the port shape (pre-1.0 deletion per D10). Codecs keep an internal `changed` local to drive joinLineBuffer and no-op short-circuits.

## 2026-06-13 — spot-check — value-flag-dash-prefixed-token-routes-to-version-help

consumesNext refuses to consume a `-`-prefixed token as a value flag's value (so `--reporter --help` keeps the help detector working). Side effect: `siro lint --severity -v` routes to the version branch (exit 0) instead of the severity validator (exit 2). Recorded as the prior trade-off; tightening would require distinguishing -v/-h from other dash-shaped values in consumesNext.

`src/cli.ts`

## 2026-06-13 — spot-check — toml-inline-comment-separator-normalised

withInlineComment re-attaches a preserved trailing `# comment` with a fixed two-space separator, normalising the author's original gap on rewrite — same class as the recorded ini single-space normalisation. D12 converges either way; recorded so a future "init changed my comment alignment" report has the prior trade-off written down for toml too.

`src/adapters/codecs/toml.ts`

## 2026-06-13 — spot-check — line-merge-normalises-mixed-eol-on-write-withdrawn

**Withdrawn** (2026-06-13): superseded by D23 — `_merge.ts` and the entire write path were removed. The mixed-EOL normalisation this entry described no longer exists.
