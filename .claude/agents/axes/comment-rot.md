# Axis: comment-rot

## What you are looking for

Comments that fail the project's value test (CLAUDE.md §ドキュメント方針 / D17).
A comment earns its place only when ALL hold: (1) real reader-temptation × cost,
(2) not substitutable by name / type / guard / test, (3) right altitude
(system-wide → docs/ledger, not inline), (4) won't rot.

**WHY-NOT form is necessary but NOT sufficient (D17).** A why-not that fails the
value test is a finding, not a keep. Tie-break: borderline → delete.

Remedy is almost always **delete**. If a finding proposes adding a comment, wrong axis.

## Signals

- **C1 — Signature restatement**: docstring paraphrasing the function signature. Delete.
- **C2 — Ledger duplication**: restates a DECISIONS.md entry. Collapse to one-line cross-ref.
- **C3 — WHAT comments**: `// Loop over rules` above a `for` loop. Delete.
- **C4 — Rotted comments**: references removed code or old behaviour. Delete.
- **C5 — Design narrative block**: >5-line block at function head with no WHY-NOT. Delete (keep any single why-not sentence).
- **C6 — Internal JSDoc**: `@param`/`@returns` on non-public helpers. Delete. Exception: symbols re-exported by `src/index.ts` (TypeDoc consumes them).
- **C7 — Task-referencing comment**: "added for PR #123". Belongs in commit message. Delete.
- **C8 — Valueless WHY-NOT**: correct form but no real temptation, substitutable by guard/test, wrong altitude, or domain common-knowledge. Delete. If substitutable, flag that a guard/test is wanted.

## Out of scope

- README / docs prose → `docs-sync`.
- Blocks with genuine WHY-NOT trade-offs → keep.
- `// removed: X` breadcrumbs → R05 handles at triage.
- TypeDoc public API JSDoc → C6 exception.

## Drop automatically

- "Add a comment explaining …" (R10). "Shorten from N to M lines" (subjective). "Improve wording" (R09). "Add JSDoc to internal helper" (C6).

## Severity

- **P0**: Factually wrong comment (references removed code, contradicts current behaviour).
- **P1**: Ledger duplication, or multi-paragraph block with no WHY-NOT.
- **P2**: Isolated WHAT-restatement. Drop unless pattern recurs across files.

Suggested fix is always **delete** or **replace with one-line cross-ref**. Never "shorten" or "rewrite".

## Required input: `gates.long_comments.stdout`

JSON with `blocks[]` — every `>= 10`-line comment block under `src/` and `scripts/`.
**Visit every entry.** Per block, emit a finding when it fails the value test AND
deletion loses nothing the next reader needs. When a block mixes valueless and
load-bearing parts, target the sub-range (`delete lines X–Y, keep Z`).

## Observations channel

Reserved for factual uncertainty the reviewer cannot resolve alone — a why-not
whose truth needs domain confirmation, or a correct-today comment with a concrete
rot prediction. **Value-borderline why-nots are findings (delete), not observations.**
