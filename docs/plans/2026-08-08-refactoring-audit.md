# Refactoring audit — architecture and documentation sync

Date: 2026-08-08
Status: implemented and verified
Baseline: `1801121` (`v0.2.0`)

## Scope and constraints

This audit ran one `architecture-drift` round and one `docs-sync` round. At audit time, it read the available ledger under `docs/docs/review/` before triage. The documented `/review` skill, `scripts/review/preflight.mjs`, and intended `docs/review/` path were absent, so the initial static gates were run directly from `package.json`.

Pre-existing staged changes at audit time:

- `memo.md` added.
- `package.json` changes the package name from `@pho9ubenaa/siro` to `@pho9ubeaa/siro`.

Verification baseline:

- `pnpm typecheck`: pass, including the layer gate.
- `pnpm test`: pass, 89 files / 685 tests.
- `pnpm knip`: pass.
- `pnpm check`: oxlint passes; oxfmt fails only on the pre-existing staged `memo.md`.
- Generated `docs/rules.md` and `docs/comparison.md`: byte-equal to the registry through the existing sync tests.

## Architecture-drift round

### A1 — P1 — Version metadata has two unenforced sources of truth

ID: `version-metadata-has-two-unenforced-sources`

Evidence:

- `docs/version-matrix.md:4-6` calls the matrix the source of truth for runtime suffixes.
- Runtime suffixes instead come from `versionNote` literals captured by rule checks, for example `src/domain/rules/block-exotic-subdeps.ts:55` and `src/domain/rules/approved-git-repos.ts:8-11`.
- `test/scripts/doc-generator.test.ts` guards only `docs/rules.md` and `docs/comparison.md`; no guard compares the version matrix with runtime metadata.
- Current drift proves the risk: `approved-git-repos` emits a Yarn 4.14.0 suffix but has no matrix section, while the matrix records pnpm `blockExoticSubdeps` as default-safe since 10.26.0 but the binding emits only `available since pnpm 10.26.0`.

Impact: maintainers can update the documented version fact without changing emitted findings, or change runtime output without updating its cited evidence. This violates the SSOT requirement even though the layer gate and tests pass.

Decision:

1. Make `RuleBinding.versionNote` the canonical runtime metadata instead of consuming it inside check closures.
2. Compose the suffix centrally when building a `Finding`.
3. Add a version-matrix sync guard that requires every binding with `versionNote` to have a corresponding matrix row and checks the literal version values.
4. Keep citations and research notes in Markdown; the guard covers identity and values, not prose.

Acceptance:

- Hand-written bindings no longer call `renderVersionNoteMessage` themselves.
- Adding or changing a `versionNote` without updating the matrix fails a test.
- The existing JSON schema remains unchanged; only message text may gain missing confirmed suffix data.

### Accepted designs not reopened

- Application composition-root allowlist entries are explicit under D01 and pass the deterministic layer gate.
- Real-module loading for `siro.config.*` despite an injected repository `FileSystem` is an explicit D02 boundary choice and is documented on `LintOptions.fs`.
- The linter-only model and external remediation are fixed by D23.
- Variable-target native import in the config loader is accepted by the D24 addendum.

## Docs-sync round

### D1 — P1 — The staged package identity contradicts every install surface

ID: `package-name-diverges-from-install-surfaces`

`package.json:2` currently says `@pho9ubeaa/siro`, while README, configuration, getting-started, generated API pages, and the staged `memo.md` use `@pho9ubenaa/siro`. The repository owner spelling also contains `UBenaA`. Local evidence therefore identifies the staged manifest edit as a typo; no registry lookup was performed.

Decision: restore `package.json` to `@pho9ubenaa/siro`; do not bulk-rename the documentation. Because the manifest edit belongs to the user, implementation must preserve it until the maintainer authorizes changing that staged line.

Acceptance: one package name appears in the manifest, README, install examples, API title, and release commands.

### D2 — P1 — Contributor setup advertises an unsupported Node floor

ID: `contributing-node-floor-is-stale`

`docs/contributing.md:5-6` says Node 20+, but `package.json:93-95` requires `^22.18.0 || ^23.6.0 || >=24.0.0` and CI tests only 22.x / 24.x. A contributor following the guide can install an unsupported runtime before any code change.

Decision: derive the displayed requirement from `engines.node` during a docs sync test or use the exact manifest range in the guide. Remove the stale Node 20 statement.

Acceptance: contributor setup, manifest engines, config-loader error text, and CI matrix describe compatible runtimes.

### D3 — P1 — The documented aube adoption policy is the opposite of the registry

ID: `aube-adoption-policy-contradicts-registry`

`docs/contributing.md:284-296` says to bind `jailBuilds` and stop and calls `advisoryCheck` out of scope. The registry currently exposes 13 aube bindings, including `advisory-check`, `block-exotic-subdeps`, `trust-policy`, and store-integrity rules.

Decision: replace the obsolete policy with the actual acceptance rule for adding an aube binding. Do not remove working bindings to match stale prose. The replacement must state that symmetry is preferred but a manager-specific control is allowed when it addresses a concrete supply-chain risk and has authoritative upstream documentation.

Acceptance: the contributing policy does not reject any current generated comparison entry.

### D4 — P1 — The version matrix omits or misdescribes live bindings

ID: `version-matrix-does-not-cover-live-bindings`

Concrete mismatches not covered by the generated-doc guard:

- `publish-access` lists npm and pnpm, but the registry binds npm, pnpm, yarn, bun, and aube.
- `files-field` omits the Deno `publish.include` binding and aube package.json binding.
- `provenance` describes Bun only as lacking native `bun publish` support, while the rule has a Bun `.npmrc` binding with `bunx npm publish` guidance.
- `block-exotic-subdeps` and `trust-policy` omit their aube bindings.
- `approved-git-repos` emits version metadata but has no matrix section.

Decision: correct all rows as one documentation change, then add the A1 sync guard. Unknown versions remain explicit `TBD`; a live binding must never be omitted merely because its version history is unknown.

Acceptance: every binding that is in scope for version research has a row marked confirmed, `TBD`, or `n/a`, and the sync guard passes.

### D5 — P1 — README's exit-code list omits the crash contract

ID: `readme-exit-codes-omit-crash-code`

`README.md:73` presents exit codes 0, 1, and 2 only. `src/cli.ts:34,229`, CLI help, and `docs/configuration.md:193-200` define exit 70 for an uncaught siro or extension error.

Decision: add exit 70 to the README summary and keep configuration.md as the detailed contract.

Acceptance: README, rendered CLI help, and configuration.md enumerate the same numeric codes.

### D6 — P1 — Review governance is orphaned under a stale documentation mirror

ID: `review-assets-live-at-undocumented-path`

The instructions require `.claude/skills/review/SKILL.md`, `scripts/review/preflight.mjs`, and `docs/review/*`. None exists at that path. The only ledger is under `docs/docs/review/`, alongside a stale duplicate of the public docs. Source comments still cite decisions such as D08 and D22 as though `docs/review/DECISIONS.md` were available.

Decision:

1. Move the five ledger files from `docs/docs/review/` to `docs/review/` without rewriting their append-only history.
2. Restore the review skill and preflight script from their documented contract.
3. Delete the stale `docs/docs/` mirror after retaining files that have no canonical root copy.
4. Add a preflight self-check that fails when the skill-required ledger files are absent.

Acceptance: the documented review command can load its skill, preflight, axes, decisions, rejections, canon, and observations from their declared paths; no second public-doc tree remains.

## Non-blocking observations

- `docs/getting-started.md` still recommends pinning `v0.0.3` although the manifest and changelog are at 0.2.0. The old version may be valid, so this is stale guidance rather than a false contract; use the current release in examples.
- README and getting-started say every finding carries `manualSteps`; the JSON contract correctly marks it optional. Reword to “fix operations or manual steps” when touching those pages.
- `scripts/check/layers.mjs:70-71` says CI still targets Node 20. This is source comment rot, outside the two requested axes, but should be deleted when the runtime docs are corrected.
- Historical CHANGELOG and implemented-plan statements are snapshots and should not be rewritten merely because the current runtime differs.

## Implementation order

1. Restore review infrastructure and remove the stale docs mirror so subsequent rounds use the right ledger.
2. Resolve the staged package-name typo before changing any generated or install documentation.
3. Fix active public/contributor prose: Node floor, aube policy, exit 70, remediation wording, and example version.
4. Refactor version metadata using Canon TDD, then regenerate and guard the version matrix.
5. Re-run the static gates and one `docs-sync` round. Do not extend the round after its first zero-finding result.

## Implementation result

Completed on 2026-08-08:

- Restored the review/TDD skills, review agents, scripts, tests, and canonical `docs/review/` ledger; removed the stale `docs/docs/` mirror.
- Restored the package name and synchronized Node support, contributor guidance, README exit codes, remediation wording, and release examples.
- Enforced the manifest Node range in both CLI startup and config loading from one shared predicate.
- Moved version notes to `RuleBinding.versionNote`, rendered them at the `Finding` boundary, and added bidirectional matrix checks for live bindings and confirmed available/default-safe version facts.
- Corrected the version matrix for the live aube, Bun, Deno, package-manifest, and Yarn bindings identified above.
- Added a preflight asset check and registered the restored review commands as knip entry points.

Verification: review preflight passes typecheck, 101 test files / 802 tests, oxlint, oxfmt, knip, and both deterministic review inventories.
