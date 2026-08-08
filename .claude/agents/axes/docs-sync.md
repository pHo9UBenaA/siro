# Axis: docs-sync

## What you are looking for

Drift between `README.md` / `docs/*.md` and the registry / source code
they describe. The user reading the docs and the user running the tool
must see the same surface.

## Strong signals

- **Rule listed in docs but absent from the registry** (`src/domain/builtin-rules.ts`),
  or vice versa.
- **PM column in `docs/comparison.md` without a binding**, or a binding
  with no column.
- **CLI flag in `README.md` USAGE block** that `src/cli.ts` does not
  parse, or a parsed flag undocumented.
- **`docs/rules.md` example using an option** that no longer exists in
  the rule's schema.
- **README "Versioning policy" claim** that contradicts a runtime
  branch on PM version anywhere in `src/` (per `DECISIONS.md` D07,
  there should be none).
- **`docs/version-matrix.md` row** for a rule × PM combination that the
  binding does not actually emit a version suffix for.
- **`docs/contributing.md`** describing a script (`pnpm gen:*`,
  `pnpm bench`) that `package.json` does not expose.

## Out of scope on this axis

- Prose quality, tone, typos in non-load-bearing text.
- Examples that are syntactically valid but stylistically dated.
- TypeDoc API output drift — that is generated on-demand and gitignored
  (`docs/api/`).

## Drop these automatically

- "Reword for clarity" — R09 / not behavioural.
- "Add diagram" / "Add link to X" — feature request, not a finding.
- Drift that an existing sync-guard test already catches — that is a
  static gate, not a review finding.

## Severity calibration

- **P0**: A documented surface (flag, rule id, PM) does not exist or
  does not behave as documented. A user following the README will fail.
- **P1**: Drift exists but is internally consistent (e.g., a rule
  description references a default that was tightened in a later PM
  version without updating the suffix).
- **P2**: Cosmetic doc drift. Usually drop.

## Promotion to sync-guard

Every P0 finding on this axis should propose **a sync-guard test** as
its fix, not a one-time doc edit. The `gen:rules` script already
produces such a guard for the rule table — extend the pattern instead
of fixing the doc by hand. If the right fix is a one-time doc edit,
say so explicitly and explain why a guard is not feasible.

## Observations channel

Doc drift that is below P2 (mildly stale phrasing that doesn't mislead
the reader), gaps where a sync-guard could plausibly extend but isn't
worth implementing now, or "this doc uses an example pattern the code
discourages elsewhere but it's not wrong" → `observations[]`. See
`docs/review/AXES.md` "Observations" section for the contract.
