# Axis: correctness

## What you are looking for

Defects. Code that produces the wrong output, crashes, corrupts data,
or violates a documented contract. Nothing else.

A finding on this axis must answer the question: **"If I write a failing
test against `main` using this reproducer, does it actually fail?"** If
you cannot write that test in one sentence, the finding is not on this
axis.

## Strong signals (look here first)

- **Edge cases in codecs** (`src/adapters/codecs/*.ts`): empty input,
  trailing newline, mixed line endings, BOM, tab vs space,
  comment-with-string-`#` boundaries.
- **Error path discipline**: `errno` propagation in
  `src/adapters/node-file-system.ts` and `node-errors.ts` — only
  `ENOENT` is silently recoverable per project convention.
- **Rule-binding contracts**: `RuleBinding.fix` returns must match its
  `fixKind` (D03); a binding emitting a `note` op from `kind: 'auto'`
  is a defect.
- **CLI exit-code routing**: usage errors → 2, findings ≥ threshold → 1,
  clean → 0. A path that returns the wrong code is a defect.
- **Reporter contracts**: `pretty` must respect `NO_COLOR`; `github`
  must emit valid workflow annotations; `json` must be parseable.

## Out of scope on this axis

- Naming, structure, readability → no axis (drop) or `architecture-drift`.
- Performance → `perf-hotspot` (only with bench evidence).
- Test quality → `test-brittleness`.
- Doc / README accuracy → `docs-sync`.
- Dead code → `dead-code`.

## Drop these automatically

- "Could be clearer if renamed" — not a defect.
- "Should validate `arg` defensively" — R08 (rejected: validate at
  boundaries, not internal calls).
- "Should return `Result<T, E>`" — R06 (rejected: speculative API
  shape design).
- Anything reachable via `pnpm typecheck` / `pnpm check` — static gate
  territory.

## Severity calibration

- **P0**: I can write a failing test today against this code. The user
  would experience wrong output, a crash, or a contract violation.
- **P1**: A plausible future call site would hit this defect; the
  invariant should be enforced statically or guarded.
- **P2**: Defensive concern with no current symptom and no call site
  that would trigger it. Almost always drop on this axis.

## Reproducer template

> Given input `<X>`, calling `<function>(<X>)` returns / throws / produces
> `<Y>`, but the documented contract requires `<Z>`.

If you cannot fill that template, the finding is not P0.

## Observations channel

Things you noticed that are not defects but worth recording — boundary
asymmetries, validation that lives at the wrong layer but never fires,
"this is correct today but a future refactor would break it", reference
equality used for values that may become objects — go in
`observations[]`, not `findings[]`. The OBSERVATIONS.md ledger accumulates
them across rounds. Do not pad; only emit observations you actually
noticed. See `docs/review/AXES.md` "Observations" section for the contract.
