# Canon TDD — definition and observed deviations

> This document fixes the project's working definition of "TDD" so that
> every reviewer, fixer, and human contributor uses the same canon. The
> canon is Kent Beck's 2023-12 clarification (translated by t-wada). It
> overrides any ambient "TDD" usage in conversation, commit messages, or
> CLAUDE.md.

## Why this exists

"TDD" has suffered semantic diffusion: the term is widely used to mean
"writing tests", "writing tests first", or even just "having a test
suite". In this repo, CLAUDE.md previously said _"t-wada の TDD でやる"_
without pinning what TDD actually is. As a result, commits labelled
`test: …` have been added without a paired source change (= no
red → green cycle), and the loop never converged on whether a test was
truly part of TDD or merely _Developer Testing_. This file is the pin.

## Definition (Beck, t-wada translation; restated in English)

TDD is a **programming workflow**. When a programmer changes system
behaviour, the goal state is:

- Everything that previously worked still works.
- The new behaviour works as expected.
- The system is ready for further change.
- The programmer and their colleagues are confident in the above.

TDD is one workflow that gets you to that state. It is **not** the only
one, and it is **not** equivalent to having an automated test suite.

## Two kinds of design (do not conflate)

The first mistake is treating these as one:

- **Interface design** — how the behaviour should be invoked (logical
  design). The shape of the API the caller sees.
- **Implementation design** — how the behaviour should be implemented
  (physical design). The structure of the code that satisfies the
  interface.

TDD separates these by phase. Step 2 (write one test) is interface
design. Step 4 (refactor) is implementation design.

## The workflow — List → Red → Green → Refactor → Repeat

### Step 1 — Test list

Enumerate the expected behaviours of the change exhaustively: the
happy path, the timeout case, the missing-key case, and so on. This
is **behavioural analysis**, not implementation planning. Add tests
that confirm existing behaviour is preserved.

**Anti-pattern.** Mixing implementation design into the list. Internal
shape decisions belong in step 4, not step 1.

### Step 2 — Write one test

Write a single, truly automated test with arrange / act / assert.
Confirm it fails. The design decisions here are primarily **interface
design** — what the caller writes.

**Anti-patterns.**

- Writing an assertion-less test "for coverage".
- Translating every item from step 1 into test code up-front. If the
  design changes mid-stream, all the speculative tests have to be
  rewritten — you're paying for tests of code that no longer exists.

The skill of "which test to write next" is what makes TDD productive;
get it wrong and the cycle drags.

### Step 3 — Make the test pass

Change the system so the test passes.

**Anti-patterns.**

- Deleting the assertion to "pass" the test.
- Copy-pasting the runtime value into the expected value. This
  collapses arrange-act-assert into arrange-act-copy and removes the
  validation step.
- Refactoring while making the test pass. "Make it work, then make it
  right." Refactor is step 4.

If you notice a missing test, add it to the list (step 1). If you
notice an idea that invalidates earlier work, decide: continue, or
restart with a different ordering. Cross off completed items.

### Step 4 — Refactor if needed

**Now** make implementation-design decisions. Improve the internal
structure without changing behaviour.

**Anti-patterns.**

- Over-refactoring (gold-plating).
- Premature abstraction. Duplication is a _hint_, not an order. Wait
  until the third occurrence (rule of three) before extracting.

### Step 5 — Repeat until the list is empty

Continue until the unease about the code's behaviour turns into
boredom. Empty list = done.

## Concepts that are NOT TDD (necessary but not sufficient)

These three are commonly confused with TDD:

- **Automated Testing** — using a framework (vitest, jest, pytest) to
  execute test code. Anyone may write it, at any time.
- **Developer Testing** — the developer writes the automated tests
  themselves. Effective when written close to the implementation.
- **Test-First Programming** — writing the test before the
  implementation, in any order, without the list/red/green/refactor
  discipline.

Most of what is attributed to "TDD" in the wild is actually the value
of automated testing or developer testing. Test-first and TDD itself
are a matter of preference; their value comes from the workflow
properties, not from being labelled "TDD".

**Practical consequence for this repo.** A `test: …` commit that adds
coverage to existing, already-working code is _developer testing_. It
may be entirely worth doing — but it is not part of a TDD cycle, and
the commit message should not imply otherwise (use `chore(test):` or
`refactor(test):` for retitling / coverage-only changes; see `D11`).

## Common misunderstandings

- TDD is not "just start writing code with a test in front". Step 1
  (test list) is consistently the first thing skipped.
- TDD is not "write a lot of tests upfront". That violates step 2.
- TDD is not "no design — just write tests". Both step 1 (interface
  design) and step 4 (implementation design) are explicit design
  phases. The slogan "Red-Green-Refactor" misses the design steps and
  is incomplete; the canonical sequence is **List → Red → Green →
  Refactor**.
- Test-first that violates TDD: ① writing too many tests up-front
  (no incremental design / development); ② not refactoring (no
  internal-quality improvement); ③ no design feedback from the
  test-writing process (the feedback cycle is not turning).

## Observed deviations in this repository

These are concrete sightings of canon violations **as of the date this
file was last updated** (see the most recent commit touching this
file). The list is a snapshot, not a live index — by the time you
read it, some entries may already be resolved. Treat each item as a
hypothesis the `tdd-discipline` axis must confirm against current code
before flagging. If an entry no longer applies, the reviewer drops it
silently; the maintainer prunes this section in a separate
`docs(tdd-canon): refresh observed deviations` commit.

### V1 — `test:` commits without paired `src/` changes (≠ TDD)

The git log since 2026-05-09 contains many `test:` commits whose diff
touches only `test/` files. Examples (commit-hash subject):

```
fa7daad  test: tighten registry override coverage and merge-rules seen guard
602d497  test: strengthen membership and shape assertions
19f6346  test(reporters): relocate jsonReporter coverage to the adapters suite
cf19090  test(disable-lifecycle-scripts): inline makeCtx() per describe
f06800f  test(bindings): consolidate multi-toMatchObject message assertions
df75d7a  test(repo-context): cover the factory directly at the unit boundary
099e0c5  test(toml-codec): pin behaviour against [[array-of-tables]] headers
67e22b4  test(domain): cover codec store and builtin-rules registry directly
b2366a5  test(filter): retitle the json reporter test
9fd1d3b  test(reporters): retitle github reporter tests
bdfe3f0  test(rules): retitle per-PM binding tests
c844383  test(rules): retitle rule-shape tests
0a8606f  refactor(test-helpers): rename memFs to createMemFileSystem
```

These are valid developer testing or test maintenance, but they are
not TDD cycles (no red phase, no paired src change). Per `D11`, future
commits of this shape carry `chore(test):` or `refactor(test):` so the
TDD label is reserved for actual cycles.

### V2 — Tests pinning literal source-code shape (= R01) — resolved

The rule-scaffolder test no longer reads source files via `readFileSync`
to regex-match their content (canon step 3 anti-pattern: copy runtime
value into expectation, in spirit). Kept as a named anti-pattern so a
regression stays easy to flag: the remedy is to make the shape
unrepresentable in the source (typed export, generated constant), not to
pin a literal-source read in the test.

### V3 — Multiple `toMatchObject` _stacked inside one_ `it`

Canon step 2 expects one arrange-act-assert. Stacked `toMatchObject`
chains inside a single `it` turn "one test for one behaviour" into "one
test for N shape slices of the same behaviour".

Caveat (the metric matters): a high `toMatchObject` _count per file_ is
NOT the signal — those may be N separate `it` blocks each with one
matcher, which is fine. The anti-pattern is multiple matchers stacked in
the SAME `it`. The `scan-test-inventory` metric is per-file, so the
reviewer must open the candidate and confirm the stacking is per-`it`
before flagging (do not flag on the raw file count alone).

### V4 — Module-level mutable `ctx` (= violates `D09`) — resolved

The three previously listed sites (`minimum-release-age`, `deno-bindings`,
`pin-exact-versions`) have been migrated to per-`describe` `ctx` per
D09. Kept as a named anti-pattern so future regressions stay easy to
flag without re-deriving the rationale.

### V5 — High `beforeEach` prevalence — shared state signal

`beforeEach` is fine on its own, but its prevalence here often correlates
with a shared mutable (`writes.length = 0`, `reads.clear()`). Per
canon, the cleaner pattern is "create the world inside each test or
each describe" so reset is unnecessary. This is a tendency, not a
blanket finding; the `tdd-discipline` axis surfaces specific cases.

## When to use this canon

- **During implementation**: when adding new behaviour, follow steps
  1–5 explicitly. The `/tdd` skill (`.claude/skills/tdd/SKILL.md`)
  encodes the workflow as a checklist.
- **During review**: the `tdd-discipline` axis
  (`.claude/agents/axes/tdd-discipline.md`) uses this file as its
  rubric. Reviewers must not invent their own definition of TDD.
- **During commit message writing**: `D11` references this canon for
  what may carry the `test:` (TDD) versus `chore(test):` /
  `refactor(test):` (developer testing / maintenance) prefix.

## When NOT to insist on TDD

This file does **not** mandate TDD for every change. Developer testing
and automated testing are recommended unconditionally; test-first and
TDD are preference-driven. The `tdd-discipline` axis does not flag
"this code was not written with TDD" — it flags claims of TDD that the
workflow contradicts.
