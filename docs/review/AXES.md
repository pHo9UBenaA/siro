# Review axes & severity rubric

> Source of truth for what a `/review` round is allowed to look for.
> Every reviewer agent loads this file, runs against **exactly one** axis,
> and emits findings only in that axis's domain.

## Why axes are isolated

Mixed-axis review (correctness + style + performance + docs in one prompt) is
the primary driver of non-convergence: subjective trade-offs (DRY ↔ explicit,
abstraction ↔ simplicity) flip-flop because no priority order exists. By
constraining a round to one axis, the reviewer's value function is well-defined
and two consecutive runs against the same diff return the same verdict.

## Severity rubric (used by every axis)

| Level       | Definition                                                                                                                                    | Action                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **P0**      | Defect — code is incorrect, unsafe, or violates a documented contract. Reproducer required.                                                   | Fix this round.                                                                       |
| **P1**      | Behavioural risk — code is correct today but a likely-encountered call site will break, or a documented invariant is not enforced statically. | Fix this round if cheap; defer otherwise.                                             |
| **P2**      | Quality concern — readability, structure, or perf headroom with no current symptom.                                                           | Default skip; surface only if a P0/P1 in the same area would be cleaner after fixing. |
| **dropped** | Stylistic, speculative, or already-decided.                                                                                                   | Append to `REJECTED.md` with rationale.                                               |

**No quota.** Empty output on a clean codebase is the expected case.
Reviewers MUST NOT pad to a target count.

## Axes

### 1. `correctness`

What it finds: bugs (wrong output, crash, data corruption, race) with a
concrete reproducer the reviewer can describe in one sentence.

Out of scope: style, naming, structure, performance, docs.

Acceptance test for a finding: "If I write a failing test against `main`
using this reproducer, does it actually fail?" If unclear, the finding is
dropped.

### 2. `architecture-drift`

What it finds: violations of the documented hexagonal layering and
single-source-of-truth invariants from `docs/review/DECISIONS.md`. Examples:
`src/domain/` importing from `src/adapters/`, a constant duplicated between
two modules without a `// from <module>` re-export, an effectful function in
a pure-domain file.

Out of scope: bugs (→ `correctness`), naming.

The static gate `scripts/check/layers.mjs` already catches import-direction
violations, including `import type`. This axis only fires when drift is
shaped in a way the gate cannot see (variable-target dynamic imports,
indirect cycles, SSOT duplication).

### 3. `test-brittleness`

What it finds: tests that pin implementation detail rather than behaviour.
This axis is the **deliberate counter-pressure** against the historical
"add another pin" reflex documented in `docs/review/REJECTED.md` §1–2.

Targets:

- Assertions on literal source-code shape (e.g., matching a closing token).
- Membership / shape sub-assertions stacked on top of an existing
  behavioural check.
- Multiple `toMatchObject` chained against the same value.
- Snapshot tests with no meaningful invariant.

The remedy is almost always either (a) delete the test, (b) replace it with
a behavioural check at the public boundary, or (c) make the shape
unrepresentable in the source so the test becomes redundant. Never "tighten"
a brittle test in place.

### 4. `docs-sync`

What it finds: drift between `README.md` / `docs/*.md` and the registry /
source code they describe. Examples: a rule listed in `docs/rules.md` that
no longer exists in the registry, a PM in the comparison matrix without a
binding, a CLI flag in the README that the parser rejects.

Out of scope: prose quality.

Most checks here should graduate into sync-guard tests (`gen:rules` already
produces one for the rule table). This axis only fires for drift not yet
covered by a sync-guard.

### 5. `perf-hotspot`

What it finds: regressions in `bench/lint.bench.ts` that exceed a documented
threshold (default: ≥10 % ops/sec drop vs the baseline recorded in
`docs/review/DECISIONS.md`).

Out of scope: speculative micro-optimisations with no measurement.

A finding without bench numbers is dropped.

### 6. `dead-code`

What it finds: unused exports, unused files, unused dependencies. Sourced
from `knip` output, surfaced as findings only after `REJECTED.md`-style
suppressions are applied.

Out of scope: "this function could be simpler" — that is `correctness` (if
buggy) or `test-brittleness` (if tests force its existence) or nothing.

### 7. `tdd-discipline`

What it finds: deviations from `docs/review/TDD-CANON.md`. Surfaces
`test:` commits without paired `src/` changes, tests pinning literal
source shape, stacked `toMatchObject` in one `it`, module-top mutable
`ctx`, internal-helper tests, and other canon violations.

Out of scope: pure test-brittleness without a canon basis → axis 3.

This axis does **not** mandate TDD for every change. It enforces the
distinction between TDD and "developer testing" (see `D11`).

### 8. `comment-rot`

What it finds: source comments that fail the value test in CLAUDE.md
§ドキュメント方針 / `D17`. WHY-NOT form is necessary but not sufficient.
Targets signature restatement, ledger duplication, WHAT comments, rotted
references, multi-line blocks with no WHY-NOT content, internal JSDoc the
types already document — AND why-not comments that guard no real
temptation, are substitutable by a test/type/guard, sit at the wrong
altitude, or will rot (C8). Value-borderline → delete (tie-break).

The remedy is almost always **delete**. If a finding's fix is "add" or
"rewrite for clarity", it is on the wrong axis.

## Authorised findings format

Every reviewer agent returns JSON with this shape:

```jsonc
{
  "axis": "correctness",
  "findings": [
    {
      "id": "stable-slug-from-message",   // for ledger lookup
      "severity": "P0" | "P1" | "P2",
      "file": "src/...:NN",
      "summary": "one sentence",
      "reproducer": "one sentence; required for P0",
      "suggested_fix": "one sentence; optional"
    }
  ],
  "observations": [                      // optional; see below
    {
      "id": "stable-slug",
      "file": "src/...:NN",              // optional
      "note": "1–3 sentences. Why it caught your eye even though it isn't a finding."
    }
  ]
}
```

The `id` field is a stable slug (lowercased, dash-separated, no axis prefix)
so triage can dedupe across rounds against `REJECTED.md`.

### Observations — sub-finding notes that accumulate

`findings[]` is intentionally narrow (must clear the axis's threshold,
must have a reproducer for P0, must not overlap `REJECTED.md`). That
filtering is why the loop converges, but it also drops thoughts the
reviewer would otherwise have shared: "I would write this differently
but it is defensible", "this allocation in a loop is fine for current
scale but worth a future bench", "this exported field looks
production-unused", "the regex is permissive in a way the docs already
admit".

`observations[]` is the channel for those. Rules:

- Emit freely. There is **no quota** and no rejection list — even
  observations that overlap `REJECTED.md` are kept (they record what
  the reviewer noticed, not what the project should fix). Reviewers
  who saw something worth saying SHOULD say it here when it does not
  clear the `findings[]` bar.
- Do not synthesise observations to pad output. "Empty" is fine.
  An observation must be a thing you actually noticed; don't invent
  notes to fill the section.
- Observations do not block convergence. A round with zero
  `findings[]` and ten `observations[]` is still a clean round; the
  observations are appended to `docs/review/OBSERVATIONS.md` and the
  axis state updates exactly as if the array were empty.
- One observation per concern; do not bundle. Same stable-slug
  discipline as findings, so future rounds can spot duplicates by
  reading the log.

Observations are drained by the `/consolidate-ledger` skill
(`.claude/skills/consolidate-ledger/SKILL.md`), not by `/review`
itself. That skill spawns the `observation-promoter` agent, which
classifies each entry as `keep` / `drop` / `promote-decisions` /
`promote-rejected`; user approval gates every ledger write. The
result is forward-ref markers appended to `OBSERVATIONS.md` (slug
suffix `-promoted-to-<id>` or `-withdrawn`) that future reviewer
rounds and consolidation runs use to skip already-resolved
entries. The log itself remains append-only — old entries are
never deleted, only marked.

### 9. `type-safety`

What it finds: type assertions (`as X`) in `.oxlintrc.json` override-permitted
files where a type-safe alternative exists, and dead overrides (glob matches
zero assertions). Non-override files are static-gate territory (oxlint
`assertionStyle: "never"` already bans them).

Remediation priority: (1) eliminate the assertion by fixing the type signature;
(2) type guard only when elimination is impossible; (3) keep as observation
when neither works. Findings must name the concrete replacement.

## Convergence

A round on axis A is **converged** when:

- two consecutive runs on A with no edits between return zero new findings, OR
- > 50 % of new findings have IDs that overlap `REJECTED.md`. This rule has no
  > minimum-count floor on purpose: a single-finding round whose only output is
  > already-declined is 100 % overlap, and re-running cannot improve on it.

When all nine axes are simultaneously converged, the codebase is at a
defensible local optimum and the loop **must** stop. Continuing past
convergence is the failure mode that produced the historical
`test:` / `refactor:` churn pattern in commit history.
