# Architectural & policy decisions

> Append-only. Each entry is a trade-off the project has already settled.
> Loaded by every `/review` round so reviewer agents do not re-litigate.
>
> **Format:** `## D<NN> — <one-line title>` followed by Context / Decision /
> Consequence (each one short paragraph). New entries go at the bottom with
> the next available number; never renumber.
>
> **Amending:** a decision's body may be corrected in place, always tagged with
> an `(amended YYYY-MM-DD: …)` marker. Headings, ids, and numbers stay fixed —
> only prose changes — so `parseDecisions` / `firstSentence` keep working.

## D01 — Hexagonal layering enforced by a deterministic gate

**Context.** `src/` is split into `cli → application → adapters / domain → shared`.
A reviewer noticing a back-edge has no way to know whether it was already
considered.

**Decision.** Layering is enforced by `scripts/check/layers.mjs`, run from
`pnpm typecheck`. The gate also catches crossings hidden in multi-line imports
and imports from `src/` that escape the source tree.

**Consequence.** The `architecture-drift` review axis only fires for back-edges
the static gate cannot see (variable-target dynamic imports, SSOT
duplication across modules, effectful code leaking into a pure-domain file).
_(amended 2026-06-12: the gate's import regex matches `import type`, so type-only
imports were removed from this list — they are static-gate territory.)_
Any finding reproducible by `pnpm typecheck` is dropped at triage as
"static-gate territory".

## D02 — Test filesystem pattern chosen by the boundary the test crosses

**Context.** Three FS patterns coexist in `test/` (memfs, `mkdtempSync` + real
FS, `spawnSync` against `dist/cli.mjs`). Each pass of an open-loop reviewer
suggests collapsing them into one.

**Decision.** Documented in `docs/contributing.md` §"Testing conventions":
memfs for `FileSystem`-port consumers, `mkdtempSync` only for adapters that
bypass the port (notably `config-loader.ts` via `jiti`), `spawnSync` only for
the published-binary subprocess test. The three are not redundant.

**Consequence.** "Unify the three FS patterns" is a rejected finding; see
`REJECTED.md` §R01.

## D03 — `RuleBinding.fix` return shape is statically constrained by `fixKind`

**Context.** Auto bindings emit only `setKey` operations; advisory bindings
emit only `note` / `ensureFileTracked`. A reviewer can mistakenly suggest
unifying the return type.

**Decision.** The discriminated union on `fixKind` is load-bearing: it lets
the application layer route operations without runtime inspection and lets
type errors catch advisory↔auto confusion at compile time.

**Consequence.** "Unify Auto/Advisory return type" is dropped at triage.
"Add runtime validation of the union" is dropped — the type system already
guarantees it.

## D04 — Line-oriented codec merges preserve user comments

**Context.** The TOML / INI codecs do not round-trip through the parser AST
for writes; they perform a line-oriented merge. _(amended 2026-06-12: YAML
was listed here in error — `yamlCodec.applyMerge` uses the `yaml` Document
API, which preserves comments natively; the line-oriented constraint applies
to TOML and INI only, where no comment-preserving JS parser exists.)_

**Decision.** Comments and key ordering in user-authored config are
load-bearing for review (annotations on why a key was added). The
line-oriented merge is the _only_ way to preserve them. Property tests cover
round-trip, idempotence, and comment preservation.

**Consequence.** "Switch to AST-based serialisation for the codecs" is
dropped. Findings against the merge code must come with a failing property
test, not a structural critique.

## D05 — `docs/rules.md` and `docs/comparison.md` are generated; the registry is SSOT

**Context.** The rule table and PM-comparison matrix are derived data. A
reviewer can flag prose drift between them and the code.

**Decision.** `pnpm gen:rules` / `pnpm gen:comparison` regenerate the docs
from the registry. A sync-guard test in `test/` fails CI if the committed
doc is stale.

**Consequence.** The `docs-sync` axis only flags drift that the sync-guard
does not yet cover (e.g., a new PM column missing from the matrix template).
"Doc says X but registry says Y" is a sync-guard bug, not a review finding.

## D06 — Bench harness uses in-memory fixtures only

**Context.** `bench/lint.bench.ts` measures on fixtures shared with the unit
suite. _(amended 2026-06-13: init.bench.ts removed with D23)_

**Decision.** Bench code never touches the real filesystem. `bench/bench-row.ts`
centralises warmup / measure constants and the `BenchRow` extraction so the
harness agrees on units (ops/sec, ms/op).

**Consequence.** "Add real-disk bench scenario" is dropped (mode mismatch
with the harness contract). Perf findings must reference a row from the
shared bench output, not a hand-rolled measurement.

## D07 — Version-agnostic linting; PM-version is documentation, not branching

**Context.** Rules target the latest stable major of each PM. `siro` never
inspects the actual installed PM version.

**Decision.** Documented in `README.md` §"Versioning policy". When a rule's
binding knows when a key was introduced, that fact is rendered into the
finding _message_ as a suffix; no code path branches on it.

**Consequence.** "Add version detection / version-specific binding paths"
is dropped. Findings about version handling that propose runtime branching
are out of scope.

## D08 — `pms` filter producing an empty common set is a usage error

**Context.** When the user's `pms` filter excludes every detected PM, the
tool could silently fall back to npm.

**Decision.** That path throws a usage error (exit 2). Silent fallback was
explicitly rejected for surprise-minimisation.

**Consequence.** "Add npm fallback" is dropped. "Improve the error message"
is in scope for the `correctness` axis only if a current user would
misunderstand it.

## D09 — Test isolation: per-`describe` context, not module-level sharing

**Context.** Shared `makeCtx()` at module top has been observed to cause
inter-suite bleed (a binding mutating `ctx.packageJson` between tests).

**Decision.** Each `describe` block constructs its own `ctx` inline; helpers
in `test/helpers/` return new instances per call.

**Consequence.** "Hoist `makeCtx()` to module scope to dedupe" is dropped;
the duplication is the isolation guarantee.

## D10 — Pre-1.0 / pre-publish: prefer deletion over deprecation

**Context.** `siro` is not yet published. CLAUDE.md authorises breaking
changes for hexagonal-correctness reasons.

**Decision.** Removed code is deleted, not commented out. Unused vars are
deleted, not `_`-prefixed. Renamed types do not need re-export shims.

**Consequence.** "Add backwards-compat shim", "Keep `_oldName` for migration",
and "Add `// removed: X` breadcrumb" are dropped (see `REJECTED.md` §R05).

## D11 — Canon TDD definition adopted; developer testing is distinct

**Context.** CLAUDE.md previously said _"t-wada の TDD でやる"_ without
pinning what TDD is. As a result, `test:` commits with no paired `src/`
change were treated as part of TDD, and the review loop never converged
on whether retroactive coverage counted.

**Decision.** Adopt Kent Beck's 2023-12 canon (t-wada translation),
restated in English at `docs/review/TDD-CANON.md`. TDD is the workflow
**List → Red → Green → Refactor**; a `test:` commit that does not
include the corresponding source change is **developer testing**, not
TDD. Both are valuable; only one carries the `test:` (TDD) label.

**Consequence.**

- Commit prefix discipline: `test:` is reserved for commits that ship
  with paired `src/` (or backing `scripts/<ctx>/lib/`) changes evidencing
  the red phase. Retroactive coverage / consolidation / retitle work uses
  `chore(test):` or `refactor(test):`.
- The `tdd-discipline` axis enforces this going forward; it does not
  rewrite history (see `R11`).
- The `/tdd` skill (`.claude/skills/tdd/SKILL.md`) encodes the workflow
  as a checklist for interactive use.

## D12 — Post-merge verification invariant (`applyVerifiedMerge`)

**Context.** The `toml` and `ini` codecs re-implement a subset of their
grammar for line-oriented writes (D04 — line merge to preserve comments).
That subset can drift from the real parser: a write may produce text that
re-parses to a different shape than intended (duplicate table, scalar
clobbered into a table, value lost to coercion). Each is a latent
corruption that only surfaces on the next read.

**Decision.** `siro init`'s write path goes through
`applyVerifiedMerge` (`src/adapters/codecs/store.ts`): after `applyMerge`,
re-parse the output and refuse to write unless (1) it parses, (2) every
assignment is observable at its keyPath, and (3) nothing else changed —
no unrelated key dropped, no scalar prefix clobbered. This is the runtime
form of D04's "preserve unrelated keys" contract. Mismatch → `ConfigError`
(exit 2), never a silent write.

**Consequence.**

- The cost is one extra `parse` per written file, on the `init`-only path.
  This is deliberate; **perf-hotspot review must not propose removing it** —
  the parse is the safety net, not an accident.
- The comparator compares timestamps (`Date` / smol-toml `TomlDate`) by
  value, and keeps `null` distinct from `undefined`, so unrelated host
  values don't read as spurious changes.
- ini coercion is intentionally a hard error here: writing a string whose
  lexeme coerces to another type (e.g. `'0'` → `0`) fails verification
  rather than landing a value the rule check would never match. Property
  generators must not emit such strings for the ini codec.
- _(amended 2026-06-11)_ The generator constraint is met conservatively by the
  property suite's `nonAmbiguousString` class (`[a-zA-Z0-9._@/+-]`), which
  excludes every shape ini's `unsafe()` rewrites on read: the coercion
  vocabulary (`true`/`false`/`null`/`-?\d+`), unescaped `;`/`#` (value cut
  there, whitespace-independent), leading/trailing whitespace (trimmed),
  both-ends-quoted values (dequoted), and `\`-escape sequences (`\;`, `\#`,
  `\\`). Interior whitespace and interior quotes DO round-trip; the class
  excludes them only as a conservative superset. Any rewritten shape fails D12
  verification by design instead of landing a value the rule check would never
  match.
- _(amended 2026-06-12)_ The "nothing else changed" comparator clobbers the
  assignment's **leaf** in the expected view too: writing a scalar at a keyPath whose
  current leaf value is an object replaces that object without failing verification.
  Intentional — the leaf is the requested write target, so replacing it is the
  remediation. Only _prefix_ clobbering (destroying a value to create a path through
  it) and _unrelated_-key changes fail verification.

## D13 — ini section handling: fail-closed on write, passthrough on read

**Context.** `.npmrc` is effectively a flat key/value file, but the `ini`
format (and the `ini` package) supports `[section]` headers that parse
into nested tables. siro's ini codec writes line-oriented; it has no model
for sections, so a top-level key write into a sectioned file would land in
the wrong scope.

**Decision.**

- **Write:** `applyMerge` throws (fail-closed) when the file contains any
  `[section]` header. A sectioned `.npmrc` is rare and unsupported; refusing
  is safer than mis-targeting.
- **Read:** `parse` keeps sections as nested objects but does **not** coerce
  values inside them (only top-level scalars are coerced). This is accepted,
  not a bug to fix: builtin rules only read top-level `.npmrc` keys, and the
  write path already fail-closes on sections, so a sectioned file never
  round-trips through siro anyway.

**Consequence.** A customRule that needs to read typed values from an ini
section must coerce them itself. If sectioned `.npmrc` support is ever
needed, both the read coercion and the write merger must grow section
awareness together.

## D14 — YAML parse keeps the default alias-expansion guard

**Context.** `yamlCodec.parse` called `toJS({ maxAliasCount: -1 })`, disabling
the `yaml` library's billion-laughs protection. A `pnpm-workspace.yaml` (or
other YAML config) can be attacker-controlled on a fork-PR CI run, where a
few KB of nested anchors expand exponentially into an OOM/hang.

**Decision.** Use the library default (`maxAliasCount: 100`) — i.e. pass no
override. siro reads only shallow config; no legitimate input needs hundreds
of alias expansions.

**Consequence.** If a real workspace ever legitimately exceeds the default,
raise the bound to a concrete finite value with that example recorded here —
never back to `-1`. Parse failure surfaces as a `ConfigError` (exit 2) via
the codec error wrap, consistent with the fail-loud parse policy.

## D15 — `requireConfigKey` extraFix keys are unconditionally required

**Context.** A `requireConfigKey` binding can carry both a `documentedDefault`
(unset primary key → advisory downgrade) and `extraFix` keys (additional
writes alongside the primary). The check used to short-circuit on the
documentedDefault before validating the extras, so a default-satisfied primary
could mask an unmet extra: lint reported the file compliant while init kept
trying to write the extra every run. No builtin combines the two fields today,
so this was latent.

**Decision.** The primary key's hard violation surfaces first (its
expected/actual is the headline); if the primary is OK or downgraded to
advisory by `documentedDefault`, `extraFix` keys are then evaluated
unconditionally. A failing extra is always a full-severity violation,
independent of `documentedDefault`. The advisory downgrade applies only to the
primary key. _(amended 2026-06-11: primary-first ordering — extras stay
unconditional, but a both-unset binding surfaces the primary, not an extra.)_

**Consequence.** When a rule that combines `documentedDefault` with `extraFix`
is eventually added, its convergence is already correct. The contract is pinned
by a synthetic test in `require-config-key.test.ts` (no production rule exercises
it yet).

## D16 — Config parse failure is fail-loud (whole run exits 2)

**Context.** `evaluateBindings` parses each bound config file before checking
it, so one unparseable optional file (e.g. a malformed `.yarnrc.yml` on a repo
where a stray `yarn.lock` made yarn look detected) aborts the entire `lint`
with a `ConfigError` (exit 2) rather than emitting a single parse-error finding
and continuing.

**Decision.** Keep the fail-loud behaviour. siro is a security tool; silently
skipping a file it cannot read would hide exactly the misconfiguration the user
asked it to audit. A broken config is a usage error (exit 2), not a finding.

**Consequence.** If the UX cost (one bad optional file blocks all other rules)
proves too high, the escape hatch is a future `--strict-parse=false` that
downgrades parse failures to per-file findings — to be added with a test and a
follow-up decision, not by quietly swallowing errors.

## D17 — Code comments must pass a value test; WHY-NOT is necessary, not sufficient

**Context.** CLAUDE.md's doc policy said "コードコメントには Why not を書く", and
the `comment-rot` axis treated WHY-NOT _form_ as a terminal justification: any
block "containing genuine WHY-NOT content" was dropped silently. A comment
phrased as a why-not therefore became unfalsifiable — no axis could ever flag
it — even when no competent reader would make the mistake it guards, when the
rationale was an unenforced invariant better expressed as a test/type, when it
sat at the wrong altitude, or when it was destined to rot. Mandating "always
write why-not" also manufactures ceremonial defensive comments.

**Decision.** A comment earns its place only when it passes a value test, ALL
of: (1) a competent reader would _plausibly_ make a wrong inference/edit here
and that mistake is costly (real temptation × cost); (2) the information cannot
be carried more durably by a name, type, guard, or test — an unenforced
invariant must be enforced, not narrated; (3) it is at the right altitude
(system-wide decisions live in docs/ledger, not inline); (4) it will not rot.
WHY-NOT form is necessary but not sufficient. **Tie-break: borderline → omit
(generation) / delete (review).** SoT is CLAUDE.md §ドキュメント方針.

**Consequence.**

- `comment-rot` now flags WHY-NOT comments that fail the value test, not only
  WHAT-restatement. Value-borderline blocks become findings (delete), not
  silent drops or observations. Expect a one-time re-baselining churn as
  previously-kept borderline why-nots (and some OBSERVATIONS.md entries) are
  re-judged under the stricter rubric; convergence is still gated by the
  2-clean stop-rule.
- The fix for a "should be enforced" invariant comment is delete + a guard or
  test. That exceeds `scoped-fixer`'s minimal-edit mandate, so such a finding
  is flagged for the maintainer rather than auto-applied.
- R10 / R12 / R13 are unchanged in spirit (delete > add / shorten); R12 is
  amended to note that a partial WHY-NOT failing the value test is deleted, not
  kept-in-part — the fix is still delete, never shorten.
- The public-surface JSDoc exception (C6 / `src/index.ts`) is unaffected.

## D18 — Bench baseline recorded for perf-hotspot comparisons

**Context.** The perf-hotspot axis requires a recorded baseline (axis brief §Baseline location); until now D06 only recorded that the harness exists, so every perf finding was structurally 'establish a baseline' rather than a comparison.

**Decision.** Record the tinybench output below as the baseline. Rows are compared by name. Re-baseline by appending a new entry (never edit this one) when fixtures, Node version, or hardware change. _(amended 2026-06-12: stripped the captured shell preamble — it embedded a contributor-local filesystem path; the measurement rows are unchanged.)_

**Consequence.** perf-hotspot findings must cite a row from this table versus a current run on comparable hardware. Captured 2026-06-12 on Node v24.3.0.

```
siro lint throughput (Node v24.3.0)

┌─────────┬───────────────────────────────────────────────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ (index) │ fixture                                                   │ ops/sec │ ms/op   │ ± sd    │ p99     │ samples │
├─────────┼───────────────────────────────────────────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ 0       │ 'small (single package, npm-bad)'                         │ '9352'  │ '0.108' │ '0.010' │ '0.132' │ 4649    │
│ 1       │ 'medium (single package, full configs, mixed compliance)' │ '8857'  │ '0.114' │ '0.015' │ '0.148' │ 4391    │
│ 2       │ 'monorepo (50 packages, pnpm)'                            │ '4432'  │ '0.227' │ '0.022' │ '0.345' │ 2202    │
└─────────┴───────────────────────────────────────────────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

```

## D19 — defaultSatisfiedSeverity 'off' is not resurrected by a rules override

**Context.** `requireConfigKey`'s `defaultSatisfiedSeverity` has two values with different mechanics: `'info'` produces a violation carrying a dynamic severity (which `applyConfig` strips under a user `rules` override, so the override's level surfaces), while `'off'` makes `check` return `state: 'ok'` — there is no finding left to re-level. A review flagged the asymmetry: a user override resurrects the `'info'` advisory at the chosen level but cannot resurrect an `'off'`-silenced case.

**Decision.** Keep the asymmetry. `'off'` means "an unset key covered by the PM's documented default is not a violation at all for this binding"; a user severity override re-levels findings, it does not redefine what counts as one. The contract is pinned by a synthetic test in `require-config-key.test.ts` (no builtin uses `'off'` today) and named in `docs/configuration.md`.

**Consequence.** Findings proposing "make user overrides resurrect `defaultSatisfiedSeverity: 'off'`" are dropped at triage. An embedder who wants override-resurrectable advisories uses the default `'info'`.

## D20 — TOML line index: planned migration to a position-aware parser

**Context.** The hand-rolled `buildLineIndex` in `src/adapters/codecs/toml.ts` re-implements a growing TOML grammar subset (tables, array-of-tables, multi-line strings, multi-line arrays, dotted keys). Each unmodeled construct is a false-failure class: D12 verification turns it into exit 2 instead of corruption, but `init` becomes unusable on legitimate files until the construct is modeled. _(amended 2026-06-13: superseded by D23 — the write path and `buildLineIndex` were removed entirely; this decision is historical context only.)_

**Decision.** The planned replacement is to derive insertion/rewrite anchors from a source-position-emitting TOML parser (e.g. toml-eslint-parser) while keeping the existing line-splice writes — D04's comment-preservation goal is untouched because the parser would only LOCATE lines, never serialise. Full AST-based serialisation remains rejected (D04). Not scheduled for 0.1.0; the 0.1.0 mitigation is multi-line array tracking plus named fail-closed errors for multi-line value rewrites.

**Consequence.** Findings proposing further grammar-subset extensions to `buildLineIndex` should be weighed against this direction first; findings proposing AST serialisation stay dropped under D04. When the migration lands, the skip-mode state machine in `buildLineIndex` is deleted, not kept as a fallback (D10).

## D21 — package.json parse failure is fail-loud at context construction

**Context.** `createRepoContext` eagerly reads and JSON-parses `package.json` when a command starts. A syntactically broken `package.json` therefore aborts the whole run with `ConfigError` (exit 2) — even on a repo (e.g. deno-only) where no evaluated rule strictly needs the file. D16 pinned fail-loud for bound config files; package.json had no decision of its own.

**Decision.** Keep the eager fail-loud parse. package.json feeds PM detection (`packageManager`), publishability (`private` / `name`), and several bindings; a corrupt file silently degrading to `undefined` would flip publish rules to N/A and hide exactly the misconfiguration a security linter exists to surface. The failure is JSON-syntax only — a schema-invalid value degrades per-field via valibot fallbacks (`safeParsePackageJson`), which is the intended soft path.

**Consequence.** "Lazy-parse package.json" / "downgrade a broken package.json to a finding" are dropped at triage. The escape hatch, if the UX cost ever proves real, is the same one D16 names: a future `--strict-parse=false`, added with a test and a follow-up decision.

## D22 — hardened-mode unset is a documentedDefault advisory, not a bare warn

**Context.** yarn enables `enableHardenedMode` automatically only for pull requests on public repositories (`isPR && isPublicRepository`) and discourages unconditional enablement for install-performance reasons. siro previously required `enableHardenedMode: true` at the rule's full `warn` severity even when the key was unset, contradicting the conditional-documentedDefault pattern already used by `frozen-lockfile` (pnpm / yarn / aube).

**Decision.** The yarn binding declares `documentedDefault: true` with a message naming the condition. Unset → `info` advisory (the default covers where it matters most; pin it to cover every install); explicit `false` → full `warn` violation; explicit `true` → ok. The rule-level severity stays `warn`.

**Consequence.** Findings proposing "raise unset hardened-mode back to unconditional warn" or "drop the rule because upstream discourages always-on" are both settled: the advisory keeps the nudge, the explicit-false case keeps the teeth. Originating review finding: F9 (2026-06-13).

## D23 — Linter-only pivot: write path removed; remediation is external

**Context.** siro originally shipped `siro init --write`, whose line-oriented TOML/INI merge re-implemented a grammar subset (D04) guarded by post-merge verification (D12) and fail-closed rules (D13 write side, D20). Remediation responsibility has moved to a separate agent-skill repository that consumes machine-readable lint output and edits files itself, with `siro lint` as the deterministic verifier.

**Decision.** Remove the write path entirely: the `init` command, `ConfigCodec.applyMerge`, the `_merge` / `verified-merge` helpers, `RepoWriteContext`, and `FileSystem.writeText`. siro is a linter. Each violation Finding carries machine-readable remediation (`fix: FixOp[]`, `manualSteps`), and the json reporter output is a versioned public contract (`schemaVersion`; docs/json-output.md). D04, D12, D13's write half, and D20 are superseded for the write path; the read-side decisions (D13 read passthrough, D14, D16, D21) stay in force.

**Consequence.** Findings proposing to re-add in-process auto-fix, to extend the deleted merge grammar, or to restore `applyMerge` on the codec port are dropped at triage — remediation lives in the external skill repo. `Finding.fix` and the json `schemaVersion` are contract surfaces: a breaking shape change requires a schemaVersion bump and a docs/json-output.md update in the same commit. The init rows in D18's bench baseline are obsolete; the lint rows remain the baseline.

## D24 — Dynamic imports via jiti: acceptable use and layer-gate coverage

**Context.** Three sites use `jiti.import(path)` with computed targets: `src/adapters/config-loader.ts` (load user-authored `siro.config.*`), `scripts/_shared/script-runtime.mjs` (`.mjs` drivers importing `.ts` library code), and `oss-benchmarks/coverage.mjs` (same `.mjs → .ts` pattern). All use variable paths, so they escape `DYNAMIC_IMPORT_RE` in the layer checker. D01 names variable-target dynamic imports as architecture-drift territory; this decision pins which uses are justified.

**Decision.** Dynamic imports are acceptable when: (1) the target path is user-determined at runtime (config-loader — no static alternative exists), or (2) the import crosses a transpilation boundary that Node cannot bridge natively (`.mjs` needing `.ts` — jiti is the standard solution). Both cases route through jiti, never raw `import()`. A new variable-target dynamic import in `src/` must justify itself against these two criteria in the PR description.

**Consequence.** "Replace jiti.import with static imports in config-loader" is dropped (the path is user-determined). "Replace jiti.import with static imports in script-runtime / oss-benchmarks" is dropped (`.mjs` cannot natively import `.ts`). A new `import()` or `jiti.import()` in `src/` that does not meet criterion (1) or (2) is a P1 architecture-drift finding. The layer checker's `DYNAMIC_IMPORT_RE` gap for variable targets is accepted (D01); human review covers it, gated by this policy.

**Addendum 2026-07-18 — superseded for all sites.** Criterion (2)'s premise no longer holds: Node ≥ 22.18 strips types natively, and jiti is removed from the repo entirely (dependencies, dev tooling, and the layer gate's allowlist). `config-loader.ts` loads `siro.config.*` via raw `import()` — justified under criterion (1) — with a per-call cache-busting query; `script-runtime.mjs` and `oss-benchmarks/check.mjs` use the same mechanism for dev tooling. The engines floor (`^22.18.0 || ^23.6.0 || >=24.0.0`) pins the runtime guarantee.
