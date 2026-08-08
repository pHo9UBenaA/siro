---
name: consolidate-ledger
description: Promotes recurring or settled OBSERVATIONS.md entries into DECISIONS.md or REJECTED.md (or drops stale ones), gated on user approval. Closes the `/review` loop's feedback path so future rounds dedupe against the actual ledger instead of accumulating sub-findings forever. Runs once per invocation, then exits.
---

# `/consolidate-ledger` — observations → DECISIONS.md / REJECTED.md

`/review` records "smell-level" notes in `docs/review/OBSERVATIONS.md`
that do not clear the findings bar. Without consolidation, those notes
accumulate forever and never feed back into the ledger that reviewer
agents dedup against. This skill is the explicit, maintainer-gated step
that closes that loop:

```
OBSERVATIONS.md ──┐
DECISIONS.md   ─┼─► observation-promoter ──► proposals
REJECTED.md    ─┘                              │
                                               ▼
                                      user approves / declines
                                               │
                                               ▼
                                      ctx ledger append (atomic write)
                                      ctx observations append (cross-ref marker)
                                               │
                                               ▼
                                      git commit (one commit per consolidation round)
```

## When to invoke

- Periodically (1–2 week cadence) after several `/review` rounds have
  accumulated observations.
- After a long stretch of `/review` runs where the same observation
  slug keeps re-emitting across axes or rounds.
- When OBSERVATIONS.md exceeds ~100 entries and the maintainer wants to
  thin it out by promoting the settled ones.

Do not invoke for:

- A single brand-new observation. The threshold for `promote-decisions`
  is ≥ 2 occurrences (or a single occurrence whose body explicitly
  states a chosen trade-off).
- Findings (not observations). Findings have their own path through
  `/review` and `scoped-fixer`.
- "Clean up the OBSERVATIONS.md file" — the log is append-only by
  design (D-equivalent rule in AXES.md). This skill never deletes
  history; it appends `-promoted-to-<id>` markers as forward refs.

## Arguments

```
/consolidate-ledger                          # consolidate everything since the last cross-ref marker
/consolidate-ledger --since 2026-05-01       # only entries on/after this date
/consolidate-ledger --axis comment-rot       # restrict to one axis
/consolidate-ledger --dry-run                # surface proposals but never invoke the write CLI
```

If no `--since` is given, default to the date of the most recent
`*-promoted-to-*` marker in OBSERVATIONS.md (i.e., consolidate
everything appended since the last successful consolidation round). If
no markers exist, scope is all entries.

## Pipeline (one invocation = one pass)

### Step 1 — Preflight (cheap)

Verify the four ledger files exist and the CLI is reachable:

```bash
node scripts/review/ctx.mjs ledger slugs --kind decisions  >/dev/null
node scripts/review/ctx.mjs ledger slugs --kind rejected   >/dev/null
node scripts/review/ctx.mjs observations recent            >/dev/null
```

If any returns a non-zero exit, abort and surface the stderr to the
user verbatim. Do not spawn the agent on a half-initialised ledger.

### Step 2 — Spawn the promoter (read-only)

Spawn `observation-promoter`. Brief it with:

- Axis filter and `--since` date if the user passed them.
- A reminder that ledger access goes through the `scripts/review/ctx.mjs`
  CLI (the agent's definition already enforces this; do NOT paste
  OBSERVATIONS.md / DECISIONS.md / REJECTED.md content into the prompt
  — the file would balloon the agent's context for no benefit).

The agent returns a JSON `{ proposals: [...] }` array. If `proposals`
is empty, report "no observations queued for consolidation" and exit.

### Step 3 — Surface proposals to the user

Render the proposals as a compact markdown table grouped by action:

```
Action: promote-decisions (N proposals)
  D-NEW-1. <title>
    slug: <observation slug>
    occurrences: <n>  first seen: <date>
    rationale: <agent's one-sentence rationale>

Action: promote-rejected (M proposals)
  R-NEW-1. <title>
    slug: <observation slug>
    occurrences: <n>  first seen: <date>
    rationale: <agent's one-sentence rationale>

Action: drop (K proposals)
  <slug>
    rationale: <agent's one-sentence rationale>

Action: keep (J proposals, not shown — kept as-is in OBSERVATIONS.md)
```

For each `promote-*` row, show the proposed `body` inline (the agent
already formatted it to match the ledger's Context/Decision/Consequence
or Suggested/Why-rejected shape).

Then ask: "Approve which proposals? Reply with `all`, a comma-separated
list of indices (e.g., `D-NEW-1,R-NEW-2`), or `none`."

**`--dry-run` short-circuits here.** Print the proposals, do not ask,
exit 0.

### Step 4 — Apply approved promotions

For each approved proposal in the user's reply:

#### 4a. `promote-decisions` / `promote-rejected`

```bash
ID=$(echo "<body>" | node scripts/review/ctx.mjs ledger append \
  --kind <decisions|rejected> --title "<title>")
```

The CLI prints the assigned `D<NN>` / `R<NN>` on stdout. Capture it.

Then append a forward-ref marker to OBSERVATIONS.md so future
consolidation rounds know the original observation has been promoted:

```bash
echo "**Promoted to** \`$ID\` ($(date -u +%Y-%m-%d))." | \
  node scripts/review/ctx.mjs observations append \
    --axis "<axis-from-proposal>" \
    --slug "<original-slug>-promoted-to-$ID" \
    --date "$(date -u +%Y-%m-%d)"
```

Slug naming convention `<orig>-promoted-to-<id>` is what the agent
uses to recognise already-promoted entries on subsequent runs (rule 1
in `.claude/agents/observation-promoter.md`).

#### 4b. `drop`

Drops are append-only too — never delete the original entry. Append
a "withdrawn" marker so future rounds know the observation no longer
applies:

```bash
echo "**Withdrawn** ($(date -u +%Y-%m-%d)): <agent rationale>." | \
  node scripts/review/ctx.mjs observations append \
    --axis "<axis-from-proposal>" \
    --slug "<original-slug>-withdrawn" \
    --date "$(date -u +%Y-%m-%d)"
```

### Step 5 — Commit

One commit per consolidation round. Include in the message:

- The count of decisions / rejecteds added and observations withdrawn.
- The assigned `D<NN>` / `R<NN>` ids (so `git log --grep` finds them).
- A one-line summary of each promoted entry.

Suggested message:

```
docs(review): consolidate N observations (D12, D13; R25 added; 3 withdrawn)
```

### Step 6 — Report

Print to the user:

- Each approved promotion with its assigned id.
- Each approved drop.
- The remaining entries (kept-as-is) so the maintainer knows what is
  still pending future consolidation.

Suggest the next invocation date if `kept` count is high (say > 20).

## Stop rules (hard)

- **One invocation = one pass.** Do not re-spawn the promoter after a
  consolidation round; the next round is the maintainer's next manual
  invocation.
- **No auto-promotion.** Every write is gated on user approval. The
  `--dry-run` flag never writes.
- **Append-only on OBSERVATIONS.md.** Never edit or delete an existing
  entry; always append markers.

## What this skill is NOT

- Not a deletion tool. The observations log keeps history forever.
- Not a refactor tool. Promotions only encode trade-offs; they do not
  change source code.
- Not a per-round step of `/review`. The two skills are independent;
  `/review` produces observations, `/consolidate-ledger` drains them.

## Bias hygiene

When spawning the promoter, do NOT include in the prompt:

- "Last consolidation found X" — would bias toward similar shapes.
- "This is the second pass on the same observations" — would bias
  toward `keep`.
- Pre-classified buckets — would defeat the agent's independent read.

Pass only: axis filter, `--since` date, and a reminder to use the CLI.
The agent's definition does the rest.
