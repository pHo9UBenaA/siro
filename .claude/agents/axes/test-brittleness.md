# Axis: test-brittleness

## What you are looking for

Tests that pin **implementation detail** rather than **behaviour**. Remedy is
almost always **delete or simplify**, not add. If a finding proposes adding an
assertion, wrong axis.

Cross-ref: `tdd-discipline` targets the same suite from the canon-TDD angle.
If a finding fits a tdd-discipline signal (S1–S6) more precisely, route it there.

## Strong signals

- **Pinning literal source shape**: assertions on tokens, brace positions, regex against source text (R01).
- **Stacked shape assertions**: `toMatchObject` + `toContain` + length check on the same value whose contract is already covered (R02).
- **Snapshot tests with no invariant**: `.toMatchSnapshot()` where the meaningful contract is a substring.
- **Internal-helper tests**: calling a non-exported helper via internal-module access.
- **Multiple tests for the same contract**: N copies of parametrised loop. Collapse or delete redundant copies.
- **Tests of generated content**: re-implementing the generator to compare strings.
- **Coverage-driven assertions**: `// for coverage` or tests executing a branch with no behavioural check.

## Out of scope

Bugs in test code → `correctness`. Test file location → drop. Slow tests → `perf-hotspot`.

## Drop automatically

"Add a regression test" (correctness does that). "Increase coverage" (binary). "Strengthen the assertion" (R02 — replacement OK, addition not).

## Severity

- **P0**: Test fails on cosmetic change (whitespace, formatter, rename) with no behavioural defect.
- **P1**: Pins implementation detail the next refactor will touch.
- **P2**: Redundant assertions but doesn't block changes. Usually drop.

Suggested fix names **what to remove** and **what to keep**. If the fix is "add", drop.

## Required input: `gates.test_inventory.stdout`

JSON with per-file metrics. Flag mappings:

| Flag                              | What it suggests            | Action                                              |
| --------------------------------- | --------------------------- | --------------------------------------------------- |
| `V3-candidate` (matchObject >= 4) | Stacked toMatchObject (R02) | Open file, find `it` blocks with stacked matchers   |
| `mock-assertion`                  | Implementation pin          | Replace with outcome assertion or delete if covered |
| `V4-candidate: module-top ctx`    | D09 violation               | Route to `tdd-discipline`                           |
| `V2-candidate: reads real src/`   | Source-shape pin (R01)      | Delete or replace with runtime guard                |
| `assertion-density` (N expect/it) | AAA splitting candidate     | Inspect highest-expect `it` blocks                  |
| `internal-imports`                | Internal-helper test        | Check if public boundary covers the same behaviour  |

**Visit every file.** One finding per file (strongest signal). Empty output is the expected end state.

## Observations channel

Borderline cases: single `toMatchObject` that arguably pins shape but tests a
complete contract, helpers at two call sites (one short of R03 threshold), tests
that read fine today but would split awkwardly if a new case landed.
