# Axis: tdd-discipline

## What you are looking for

Deviations from the project's canon TDD definition (`docs/review/TDD-CANON.md`).
Read it in full before starting. This axis is its enforcement arm.

## Signals

- **S1 — `test:` commit with no paired `src/` change**: Check via `git log --since='30 days ago'`. Paired `docs/`/`bench/`/`test/`-only changes don't count. Bounded by R14 + D11 — record in `observations[]` only, never `findings[]`.
- **S2 — Source-shape pin tests (V2)**: Tests asserting against source-code shape via `readFileSync`. Currently resolved (no live instance) — regression watch only. Don't mistake CLI-output reads, fixture reads, or docs-sync guards (D05) for S2.
- **S3 — Stacked `toMatchObject` in one `it`**: >= 2 calls in same `it()`. Gate flag is per-file — confirm per-`it` by opening the file. Note `test/helpers/binding-expectations.ts` is the de-stacking fix, not a stacker.
- **S4 — Module-top mutable `ctx`**: `const ctx = makeCtx()` at module top violates D09. Fix: move into per-describe block.
- **S5 — Tests of internal helpers**: Imports of non-exported symbols. Behaviour belongs at the public boundary.
- **S6 — `beforeEach` with state reset**: `beforeEach(() => { writes.length = 0 })` signals shared mutable that should be per-test.

## Out of scope

Pure test-brittleness without canon basis → `test-brittleness`. Bugs → `correctness`. Slow tests → `perf-hotspot`.

## Drop automatically

"Add a test for X" / "Increase coverage". "Rename test title" (R09). "Add a snapshot test" (R01-class). Any fix adding `toMatchObject` calls or rewriting commit messages.

## Severity

- **P0**: Blocks safe refactor (source-shape pin, shared mutable causing cross-test bleed).
- **P1**: Normalises anti-pattern across suite (helper producing stacked matchers).
- **P2**: Isolated, no propagation. Usually drop.

## Required input: `gates.test_inventory.stdout`

JSON with per-file metrics. Flag mappings:

| Flag                              | Signal   | Action                                        |
| --------------------------------- | -------- | --------------------------------------------- |
| `V3-candidate` (matchObject >= 4) | S3       | Confirm stacking in same `it`                 |
| `V4-candidate: module-top ctx`    | S4       | Flag if `makeCtx()` at module top             |
| `V2-candidate: reads real src/`   | S2       | Regression watch                              |
| `mock-assertion`                  | Impl pin | Check if outcome already covered              |
| `internal-imports`                | S5       | Verify symbol is non-exported before flagging |

**Visit every file.** Spot-check unflagged files too.

## Observations channel

Canon-adjacent thoughts: `test:` commit with trivial paired change, `describe` mixing List-step and retroactive coverage, helper with a single user.
