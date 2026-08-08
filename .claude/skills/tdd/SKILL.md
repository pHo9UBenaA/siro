---
name: tdd
description: Drive a single behaviour change through Canon TDD (Beck/t-wada). List → Red → Green → Refactor. Enforces step order and refuses to write tests for already-passing code under the TDD label. Does NOT cover retroactive coverage — that is developer testing.
---

# `/tdd` — Canon TDD workflow

This skill is the implementation-side counterpart to `/review`. It
encodes Kent Beck's TDD definition (as translated by t-wada) so the
"red phase" is never skipped and the "TDD" label only attaches to
commits that actually rode the cycle.

**Read before doing anything:**

- `docs/review/TDD-CANON.md` — the full canon. This skill assumes you
  have read it; do not re-derive the definition.
- `docs/review/DECISIONS.md` D11 — the commit-prefix policy that this
  skill enforces.

## When to invoke

- The user is about to add **new behaviour** to this project.
- The user types `/tdd "<one-sentence description of the change>"`.

Do **not** invoke this skill for:

- Pure refactoring (no behaviour change) — go directly to refactor;
  the existing tests are your safety net.
- Retroactive coverage of existing behaviour — that is _developer
  testing_, not TDD. Tell the user to commit it with
  `chore(test):` / `refactor(test):` (D11) and skip this skill.
- Bug fixes coming from `/review` — `/review`'s `scoped-fixer` agent
  already handles that path with the Canon-TDD steps baked in.
- Feature **design** (interface shape, architecture, abstractions
  across multiple files). That belongs to the `feature-dev:feature-dev`
  skill, which runs codebase exploration and architecture phases
  before implementation begins. `/tdd` is the implementation arm
  invoked **after** feature-dev has settled the shape — feature-dev
  hands off a test list and `/tdd` rides each item through red →
  green → refactor.

## Arguments

```
/tdd "<one-sentence behaviour description>"     # required
/tdd "<...>" --scope src/domain/services         # optional scope hint
```

## Pipeline

### Step 1 — Test list (List)

Ask the user to enumerate the expected behaviours of the change.
The list must be **behavioural** (inputs and observed outputs), not
implementation-shaped ("internal helper X", "use a Map" — those
belong in step 4).

Write the list to `.claude/state/tdd-list.json`:

```jsonc
{
  "title": "<one-sentence description>",
  "scope": "<paths>",
  "created_at": "<ISO-8601>",
  "items": [
    { "id": "happy-path", "summary": "given X, returns Y", "status": "todo" },
    { "id": "timeout", "summary": "after Nms, returns timeout result", "status": "todo" },
  ],
}
```

Show the list back. Ask: "Anything missing? In what order should we
tackle them?" Iterate until the user is satisfied. **Do not start
writing tests yet.**

### Step 2 — Write one test (Red)

Pick the first `todo` item. Write **one** automated test for it with
arrange / act / assert. Run it; **confirm it fails for the right
reason** (not a typo, not a missing import — the assertion fires).

Show the failing-test output to the user. Hard stops:

- If the test passes immediately, the behaviour already exists — an
  earlier item's Green covers it. Keep the test as a regression guard
  when it pins a distinct contract no other test asserts (commit it
  `chore(test):`, not `feat:` — it has no red→green of its own, D11);
  drop it only when another test already covers the same input→output.
  (If the _entire_ list is pre-passing, the user wanted developer
  testing — exit and route them to a `chore(test):` commit.)
- If the test fails for the wrong reason (compile error, typo,
  unresolved import), make it fail on the assertion instead. For a
  brand-new symbol the import won't resolve yet: add the smallest
  _non-satisfying_ stub (a signature that compiles but returns a value
  the assertion rejects) so the failure moves onto the assertion. The
  stub is not Green — step 3 replaces it.
- If you find the test list needs a new item mid-write, add it to
  the list (back to step 1) before continuing.

### Step 3 — Make the test pass (Green)

Change the system until the test passes. **No refactoring in this
step** — the goal is "make it work", not "make it right".

Anti-patterns the skill refuses:

- Deleting the assertion to pass.
- Copy-pasting the runtime value into the expected slot.
- Refactoring unrelated code while green-ing.
- Implementing items beyond the current list entry.

When green, mark the item `done` in the state file.

### Step 4 — Refactor (only if needed)

Now make implementation-design choices. Improve internal structure
without changing behaviour. The full test suite must stay green
throughout.

Anti-patterns the skill refuses:

- Over-refactoring (gold-plating, speculative abstractions).
- Premature DRY (rule of three: wait for the third duplication).
- Renaming / restructuring that touches files outside the change's
  scope.

Comments here follow the CLAUDE.md value test (D11's sibling policy, D17):
write one only when it passes (real temptation × cost, not substitutable by a
name/type/test, right altitude, will not rot); borderline → omit. This
overrides any generic "well-documented code" nudge from `feature-dev`.

### Step 5 — Commit and repeat (List)

Stage the test + code change. Compose a commit:

- Subject: `feat(<area>): <summary>` (new behaviour) or
  `fix(<area>): <summary>` (bug fix going through TDD).
- Body: 1–2 sentences on **why** (per CLAUDE.md, commit log = Why).
- The commit subsumes one list item; do not bundle multiple cycles.

After commit, if `items` still has `todo` entries, return to step 2.
When the list is empty, the skill is done — report the cycle count
and the list to the user, then exit.

## State lifecycle

- `.claude/state/tdd-list.json` is created in step 1, updated through
  steps 2–5, and **deleted** when the list is empty.
- Multiple concurrent `/tdd` sessions are not supported. If the file
  exists at step 1, ask the user whether to resume the prior session
  or discard it.

## Refusal modes

The skill MUST refuse, with a short explanation, when:

- The user wants to "add tests for the existing function". Route them
  to `chore(test):` (D11).
- The user wants to "refactor X". Tell them to do the refactor
  directly; this skill is for behaviour changes only.
- The test list contains items that mix implementation design ("use
  a Set"). Push back: rewrite as a behavioural item, or — if the item
  names no observable input→output that another item does not already
  cover — drop it (do not force a vacuous rewrite). The implementation
  choice resurfaces in step 4.
- The user wants to skip step 2 ("just write the code, we'll add a
  test later"). That is _test-after_, not TDD. Either accept it
  explicitly (label the commit `feat:` without invoking this skill)
  or come back when the test list is ready.

## What this skill is NOT

- Not a substitute for developer testing. If you are adding tests to
  build confidence in existing code, that work is valuable but not
  TDD; commit it as `chore(test):` or `refactor(test):`.
- Not a way to "do TDD faster" by batching steps. The canon's
  productivity claim depends on per-item red→green→refactor cycles.
  Batching turns the workflow into test-first programming, which has
  different (and weaker) properties.
- Not a commit-message linter. The `tdd-discipline` review axis
  enforces the prefix policy across the repo; this skill only sets
  the prefix for commits it creates.
