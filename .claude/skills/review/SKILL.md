---
name: review
description: Bounded, axis-isolated code review with a memory of prior decisions. Runs deterministic gates first, then a single-axis LLM reviewer, then triages findings against the project ledger. Stops on convergence — does NOT loop indefinitely. Use this instead of pasting docs/review-prompt.md into a subagent.
---

# `/review` — convergent review loop

This skill replaces the historical "paste a checklist into a subagent and
loop forever" workflow. The loop now has a stop rule, a memory, and
deterministic pre-flight. Two consecutive runs against an unchanged tree
return the same verdict; runs against a clean tree return zero findings.

**Read these files before starting any round:**

- `docs/review/AXES.md` — axis definitions, severity rubric, finding format.
- `docs/review/DECISIONS.md` — settled trade-offs. Do not re-litigate.
- `docs/review/REJECTED.md` — explicitly declined findings. Drop on sight.
- `docs/review/TDD-CANON.md` — Canon TDD (loaded by `tdd-discipline` axis
  and by the `scoped-fixer` agent when it writes tests).

If any of those four files is missing, abort and tell the user the ledger
is not initialised.

## Not to be confused with `code-review`

Claude Code ships a user-level skill named `code-review` that reviews
the current diff at low/medium/high/max effort and can post inline
comments. That is the **general** review skill.

`/review` (this file) is the **project-specific bounded loop**. The two
do different jobs:

|            | `code-review`        | `/review` (this)                        |
| ---------- | -------------------- | --------------------------------------- |
| Scope      | current diff / PR    | full repo or named subdir + diff        |
| Memory     | none                 | ledger (DECISIONS, REJECTED, TDD-CANON) |
| Axes       | one combined pass    | one of eight named axes per round       |
| Stop rule  | one shot             | hard convergence rules                  |
| Use it for | quick PR sanity pass | weekly / pre-release deep review        |

Use `code-review` for ad-hoc PR sanity. Use `/review` when the user
reports the loop "is not converging" or wants the bounded, axis-isolated
loop.

## When to invoke

- The user types `/review` or asks for a code review.
- A round of implementation has just finished and the user wants a check.
- The user reports the review loop "is not converging" (this skill IS the
  convergence fix).

Do not invoke this skill for:

- Fixing a single bug the user already pointed at — just fix it.
- Refactoring on the user's instruction — they have already decided.
- "Make the code nicer" without a target — that is the failure mode the
  skill is designed to prevent. Ask for a specific axis or a specific file.

## Arguments

The skill accepts optional inline arguments:

```
/review                                # auto-rotate axis, scope = full src
/review axis=correctness               # explicit axis
/review axis=test-brittleness path=test/domain
/review --since main                   # diff scope only
```

If no `axis` is given, pick the next axis in **rotation order** below.
Rotation cursor lives at `.claude/state/review-axis.txt` (single line,
just the last axis name run). If missing, start with `correctness`.

Rotation order (fixed):

```
correctness → architecture-drift → test-brittleness → docs-sync
    → perf-hotspot → dead-code → tdd-discipline → comment-rot
    → type-safety → (loop)
```

If no `path` / `--since` is given, scope is `src/` + `test/` + `bench/` +
`scripts/`. The reviewer is instructed to emit at most one finding per
file (forces depth over breadth).

## Pipeline (per invocation)

### Step 1 — Preflight (deterministic)

Run `node scripts/review/preflight.mjs` and parse the JSON output.

**If any gate fails**, stop. The failures ARE the findings — surface them
to the user verbatim and exit. Do not run any LLM agent; an LLM cannot
improve on what the type-checker already proved.

### Step 2 — Convergence check (cheap, before spending tokens)

Read `.claude/state/review-last-findings.json`. Schema:

```jsonc
{
  "<axis-name>": {
    "head_sha": "git rev-parse HEAD at the time of the run",
    "scope": "paths or diff range used",
    "clean_run_count": 0,                              // 0, 1, or 2+
    "round_verdict": "open" | "clean" | "overlap-stop",
    "findings": [ /* the full reviewer-emitted list, including dropped */ ],
    "must_fix_count": 0,
    "ran_at": "ISO-8601"
  }
}
```

`clean_run_count` is the count of consecutive zero-finding rounds at the
current `head_sha` on this axis. The AXES.md canonical convergence rule
requires **two** such rounds, so `clean_run_count >= 2` is the only
condition under which Step 2 may short-circuit the LLM reviewer.

For the current `<axis>`:

1. If no entry exists for `<axis>`: proceed to Step 3 (first run).
2. If the entry's `head_sha` equals `git rev-parse HEAD` **and** the
   scope intersection has no edits (`git diff --quiet <head_sha> -- <scope>`):
   - If `clean_run_count >= 2`: report **"converged on `<axis>` at
     `<head_sha>` (confirmed across N consecutive clean rounds)"** and
     exit at Step 9 with no changes.
   - If `round_verdict == "overlap-stop"`: report **"non-converging
     on `<axis>` at `<head_sha>` (REJECTED overlap exceeded threshold)"**
     and exit at Step 9 with no changes.
   - Otherwise (`clean_run_count` is 0 or 1, or last round was `"open"`):
     proceed to Step 3. A single clean round is **not** enough — running
     again is how the two-run rule is satisfied. Bypassing this would
     collapse the canonical rule to one round and let a single
     false-negative permanently mark the axis done.
3. If `head_sha` or scope has changed: proceed to Step 3. Step 8 resets
   `clean_run_count` to 0 (or to 1 if this round is itself clean).

The state file is local-only (gitignored). It is safe to delete to
force a fresh run.

### Step 3 — Reviewer (single axis)

Spawn the `code-reviewer-axis` subagent (read-only by definition). Brief
it with:

- The axis name and the scope (file paths or diff range).
- **Ledger access is via the CLI, NOT inline file content.** The
  agent's definition (`code-reviewer-axis.md`) directs it to call
  `node scripts/review/ctx.mjs ledger slugs --kind <kind>` for each
  ledger up front and `ctx ledger get --kind <k> --id <id>` lazily
  when a finding might overlap. Do not paste AXES.md, DECISIONS.md,
  REJECTED.md, or TDD-CANON.md bodies into the prompt — they would
  contribute ~33K of bytes per round that the CLI satisfies with
  ~8K of slugs + ~500B per on-demand `get`. The reviewer cannot
  access `OBSERVATIONS.md` at all (it grows monotonically; the
  maintainer consolidates).
- The axis-specific prompt from `.claude/agents/axes/<axis>.md`.
- **When `axis == dead-code`**, also pass `gates.knip.stdout` from the
  preflight JSON. The agent uses it directly instead of re-running
  `knip` (which would double the latency).
- **When `axis == comment-rot`**, also pass `gates.long_comments.stdout`
  from the preflight JSON. The agent must visit every block in that
  list — without this, the LLM reviewer historically stopped at the
  first hit and missed the other long-comment files.
- **When `axis == test-brittleness` or `axis == tdd-discipline`**, also
  pass `gates.test_inventory.stdout`. The inventory enumerates every
  test file with shape metrics (it/describe counts, toMatchObject
  density, mock-assertion presence, internal-layer imports, V2/V3/V4
  candidate flags). Same reasoning as comment-rot: without the
  deterministic list, the LLM stops at one example and misses the
  other test files.

The reviewer returns JSON in the format specified by `AXES.md`. **No quota.**
Empty output is acceptable and expected on a clean codebase.

**Bias hygiene (orchestrator → agent prompt).** When spawning the
reviewer agent, do NOT include any of the following in the prompt,
even when factually true:

- "round 1 was clean / returned 0 findings"
- "no diff since the last run / src is unchanged"
- "this is the confirming round" / "this is round 2"
- "previous verdict was X" / "prior round dismissed Y as Z"
- a recap of which findings the prior round produced and fixed

These framings consistently cause the agent to short-circuit at
~10–30 % of full depth. The orchestrator's Step 2 already decides
whether to spend tokens; once it decides to spawn the agent, the
agent runs as if it were the first ever invocation. Pass only:
ledger files, axis name, scope, axis brief, and the relevant gate
output. Recording the same axis name twice in one session is the
_only_ signal the agent should receive about repeat invocations.

### Step 4 — Triage

Spawn `finding-triage`. It receives the reviewer's JSON. The agent's
definition (`finding-triage.md`) directs it to fetch ledger contents
via the same `scripts/review/ctx.mjs` CLI Step 3 uses — slug-index
first, lazy `get` only when a finding's intent might overlap. Do not
paste ledger bodies into the triage prompt either. Triage:

- Operates only on the `findings[]` array. The reviewer's
  `observations[]` array is forwarded untouched to Step 7.5; triage
  does NOT filter, classify, or drop observations.
- Drops any finding whose intent matches an entry in `REJECTED.md`
  (semantic match, recorded as `ledger-rejected:Rxx`).
- Drops any finding that the project's static gates (preflight) could
  have caught (re-runs the relevant tool to verify if uncertain).
- Drops any finding not tied to a behaviour change the reviewer can name.
- Classifies the remainder into `must-fix` (P0 / P1 with reproducer),
  `discuss` (P1 ambiguous), `defer` (P2).
- Emits a **single-round** verdict (`round_verdict`):
  - `"clean"` — 0 findings this round (does NOT mean converged on its own).
  - `"overlap-stop"` — `>50%` of findings overlap `REJECTED.md`; the
    orchestrator should stop this axis even with findings present.
  - `"open"` — normal must-fix flow.

The cross-run convergence decision (two consecutive `"clean"` rounds) is
the orchestrator's job (Step 8); triage never emits `"converged"`.

### Step 5 — Surface to user

Show the user a short summary in this exact shape:

```
Axis: <axis>
Preflight: OK
Findings: N total → M must-fix, K discuss, L defer, D dropped (ledger / static)
Observations: O recorded (appended to docs/review/OBSERVATIONS.md)
Convergence: <converging | converged | non-converging>

Must-fix:
  1. <file:line> [P0] <summary>
     Reproducer: <one sentence>
  …

Discuss:
  …
```

If `O > 0`, mention that the observations were appended to
`OBSERVATIONS.md` but do NOT inline their content — the file is the
display surface for observations, not the user-facing summary. (They
should be terse one-liners anyway; if a reviewer wants to surface
something prominently, that's what `findings[]` is for.)

Then ask: "Apply must-fix? (y / n / individual indices)". Do **not** apply
without explicit user approval, even in auto mode — the cost of an
unwanted edit is higher than the cost of asking.

### Step 6 — Apply (only if user approved)

Spawn `scoped-fixer` with the exact list of approved findings. The fixer:

- Applies only the changes listed; no opportunistic refactor, no rename,
  no extracting helpers, no adding tests beyond a regression for the
  reproducer.
- Returns the diff plus the test command that exercises the change.

### Step 7 — Post-fix verification

Re-run `scripts/review/preflight.mjs`. If anything fails, ask the user to
review (do NOT auto-revert — the fix may be correct and a test may need
updating).

### Step 7.5 — Append observations to OBSERVATIONS.md

The reviewer's JSON (Step 3) may include an `observations[]` array
alongside `findings[]`. Observations are sub-finding notes the reviewer
recorded but did not promote to a finding — smell-level concerns,
boundary asymmetries, "fine today but I'd watch this". See
`docs/review/AXES.md` "Observations" section for the contract.

The pipeline appends them to `docs/review/OBSERVATIONS.md` via the
write CLI (one invocation per observation):

```bash
echo "<note body>" | node scripts/review/ctx.mjs observations append \
  --axis <axis> --slug <observation.id> --date <YYYY-MM-DD> \
  [--file <file:line>]
```

The CLI owns the heading format (`## YYYY-MM-DD — <axis> — <slug>`),
the blank-line separator policy, and the validation that rejects
control characters in the slug or axis. Rules:

1. **Append-only.** The CLI never rewrites prior entries; never
   delete entries that pre-date this round. The log is the project's
   accumulated memory of "things reviewers thought worth noting" and
   its value is in being complete across history.
2. **One CLI call per observation.** Batching is not supported — each
   observation has its own slug, file, and note, and one-call-per-entry
   keeps the recorded order matching the reviewer's emit order.
3. **No dedup against existing entries.** If reviewer round R12 says
   the same thing reviewer round R3 said, both entries stay — the
   recurrence itself is a signal worth keeping. The maintainer
   consolidates by promoting an observation to `DECISIONS.md`,
   `REJECTED.md`, or a finding in a future round; the original
   entries remain.
4. **Empty observations array is fine.** Skip the append; this step
   does nothing. Do NOT synthesise observations after the fact.
5. **This step runs whether or not Step 6 applied fixes.** A clean
   round with observations still gets its observations recorded. A
   round that produced findings AND observations records both
   (findings go to state, observations go to the log).

The orchestrator MUST NOT pass `OBSERVATIONS.md` back to the reviewer
agent in Step 3 — the file grows monotonically and would cost a lot
of tokens for no reviewer benefit (the agent's job is to emit what it
notices THIS round; deduping is the maintainer's job at consolidation
time).

### Step 8 — Update state & ledger

1. **Compute the new `clean_run_count`** for `state[axis]`:
   - If `round_verdict == "clean"`:
     - If a previous entry exists, its `head_sha` matches HEAD, and the
       scope is unchanged: `clean_run_count = previous + 1`.
     - Otherwise (no previous entry, or different `head_sha`, or scope
       changed): `clean_run_count = 1` (start of a fresh streak).
   - Else (`"open"` or `"overlap-stop"`): `clean_run_count = 0`.

2. **Write `state[axis]`** via the CLI so the atomic temp+rename path
   is exercised:

   ```bash
   echo '<JSON entry>' | node scripts/review/ctx.mjs state set --axis <axis>
   ```

   The JSON payload carries `head_sha`, `scope`, `clean_run_count`,
   `round_verdict`, `findings` (full list including dropped),
   `must_fix_count`, `ran_at` — per the Step 2 schema.

3. **Overwrite `.claude/state/review-axis.txt`** with the axis just run.
   Next invocation reads it and picks the next axis in rotation order.

4. **REJECTED.md proposals.** For each finding the user rejected this
   round, propose an entry for `REJECTED.md` and **ask the user to
   approve the rationale before committing it**. Never auto-append to
   the ledger. Once approved, write via the CLI rather than editing
   the file by hand:

   ```bash
   echo "<entry body>" | node scripts/review/ctx.mjs ledger append \
     --kind rejected --title "<stable-slug>"
   ```

   The CLI computes the next `R<NN>` id atomically; the stdout echo
   is the assigned id (e.g., `R15`). Sub-finding observations (notes
   the reviewer recorded but did NOT promote to a finding) follow
   their own path — they are drained by the `/consolidate-ledger`
   skill, not by this step.

5. **Optional debugging.** `node scripts/review/convergence.mjs <axis>`
   prints the on-disk state plus the overlap-rate against `REJECTED.md`
   for the maintainer's "why didn't the loop stop?" inspection. Triage's
   report is authoritative; the script is a debugging aid.

### Step 9 — Report

Tell the user: axis run, fixes applied (file count + line delta), and
the **convergence status** computed from the post-Step-8 state:

- `clean_run_count >= 2` → "**converged** on `<axis>` at `<head_sha>`".
- `clean_run_count == 1` → "**clean (1/2)** — re-run `/review axis=<axis>`
  on the same HEAD to confirm convergence". (Without the second run, the
  axis is _not_ converged.)
- `round_verdict == "overlap-stop"` → "**non-converging** on
  `<axis>`: >50 % of findings overlap `REJECTED.md`; stop this axis
  and either update the ledger or switch axes".
- Otherwise → normal must-fix report with the must-fix / discuss / defer
  counts from triage.

Suggest the next axis to run, or tell the user all axes are converged
once every entry in `state[*].clean_run_count` is `>= 2`.

## Stop rules (hard)

The skill MUST stop the outer loop on an axis when:

1. `clean_run_count >= 2` at the current `head_sha` (two consecutive
   clean rounds; canonical AXES.md rule 1).
2. `round_verdict == "overlap-stop"` (`> 50 %` of findings overlap
   `REJECTED.md`; canonical AXES.md rule 2).
3. The user declines every finding in a round (signal: LLM review value
   exhausted; advise switching axes or stopping).

A single `clean` round (`clean_run_count == 1`) is **not** a stop
condition — the loop must re-run once more on the same HEAD to confirm.

Do not auto-invoke `/review` again from inside the skill. If the user
wants the next axis (or the confirming re-run on the same axis), they
invoke it explicitly.

## What this skill is NOT

- Not a continuous background process. One run = one axis = one round.
- Not a substitute for the static gates. Findings a tool can catch are
  the tool's job; the skill drops them at triage.
- Not a "find more issues" amplifier. Empty output is the goal state.
