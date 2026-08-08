# Rejected findings ledger

> Append-only record of review findings the maintainer has explicitly
> declined, with rationale. Loaded by every `/review` round; any new
> finding whose `id` matches an entry here is dropped at triage **without**
> being shown to the user.
>
> **Format:** `## R<NN> — <stable-slug>` followed by what the reviewer
> suggested, why it was rejected, and (where useful) the commit / PR where
> the trade-off was settled. New entries go at the bottom with the next
> available number; never renumber.

## R01 — pin-literal-source-close

**Suggested.** Add an assertion against the literal closing token of a
multi-line array / object literal (e.g., `expect(source).toMatch(/] as const;$/m)`)
so the test fails if the shape ever drifts.

**Why rejected.** Tests pinning literal source shape are brittle by
construction: any whitespace or formatter change breaks them, and they do
not exercise behaviour. The correct remedy when the shape genuinely matters
is to make the drift impossible in the source (typed export, generated
constant, exhaustive `satisfies` clause). See commit `39cb72e` for the
historical instance that motivated this entry.

Related: `test-brittleness` axis primary target.

## R02 — stack-membership-and-shape-assertions

**Suggested.** Add a `toContain` / `toMatchObject` on top of an existing
behavioural assertion to "tighten coverage" or "strengthen the contract".

**Why rejected.** If the existing assertion already pins the contract, an
additional shape check tests the test, not the code. Each extra pin is a
future review finding ("over-specified test") that the maintainer must
re-litigate. Coverage of a contract is binary: either the assertion
exercises the public behaviour or it does not.

Acceptable variants: replacing a weak assertion with a stronger one (net
zero pins); deleting a pin that the strengthened assertion subsumes.

## R03 — premature-fixture-consolidation

**Suggested.** Extract fixture `X` into `test/helpers/` because it appears
in two test files.

**Why rejected.** Default threshold for extraction is **three** call sites
with byte-identical content. Two-site consolidation couples otherwise
independent test files and the next review round flags the helper as
"unclear ownership". Inline duplication beats premature DRY for fixtures.

## R04 — extract-helper-for-one-call-site

**Suggested.** Extract `<inline expression>` into a named helper.

**Why rejected.** Extraction below two non-trivial call sites is premature.
Three similar lines beat a coupled abstraction. Helpers introduced for one
caller become next-round findings as "indirection with no payoff".

## R05 — backwards-compat-shim-or-renamed-stub

**Suggested.** Keep `_oldName` / re-export the old type / leave a
`// removed: X` breadcrumb when deleting or renaming a symbol.

**Why rejected.** Pre-publish (`siro` has no released consumers; CLAUDE.md
authorises breaking changes). Deletion is unambiguous; shims become
permanent debt the moment a release happens. Captured in `DECISIONS.md` D10.

## R06 — speculative-result-or-option-wrapping

**Suggested.** Make `<function>` return `Result<T, E>` / `Option<T>` so future
callers can handle the failure mode without exceptions.

**Why rejected.** No current caller needs the wrapping; structured errors
are handled by the single `run()` catch in the CLI entry. Speculative API
shape design is dropped until a concrete second caller exists.

## R07 — mixed-axis-finding

**Suggested.** A single finding that combines correctness + style + perf
("`foo` is hard to read AND has a redundant branch AND allocates in a hot
path").

**Why rejected.** Convergence requires axis isolation. Mixed-axis findings
have a value function the reviewer cannot defend across rounds and produce
the historical flip-flop pattern. The reviewer must split into one finding
per axis or drop.

## R08 — defensive-revalidate-internal-input

**Suggested.** Validate `<argument>` at the start of an internal function
"in case a future caller passes a bad value".

**Why rejected.** Validation belongs at system boundaries (CLI flags,
config-file parse, FS reads). Internal functions trust their callers; the
type system documents the contract. Adding `if (!arg) throw ...` to an
internal helper adds branches with no behavioural change and never fires.

## R09 — rename-for-naming-aesthetic

**Suggested.** Rename `<symbol>` to `<other>` because the new name reads
better.

**Why rejected.** Pure-rename diffs across many files churn `git blame`
without changing behaviour. Accept only when (a) the old name is actively
misleading (factually wrong, not just suboptimal) or (b) the rename is part
of a behavioural change touching the same site.

## R10 — JSDoc-or-comment-for-self-explanatory-code

**Suggested.** Add a docstring / inline comment to `<function>` describing
what it does.

**Why rejected.** CLAUDE.md guidance: "コードコメントには Why not を書く"
(comments document the non-obvious WHY-NOT, not the WHAT). Well-named
identifiers document the WHAT. Comments restating signature or behaviour are
removed, not added.

## R11 — rewrite-historical-test-commit-prefixes

**Suggested.** Rewrite past `test: …` commit subjects to `chore(test):` /
`refactor(test):` based on the new D11 / Canon TDD policy.

**Why rejected.** D11 is forward-looking. Rewriting history rebases
diverges from the published `git log`, breaks anyone who has the SHA
in a bookmark, and produces no behavioural change. The `tdd-discipline`
axis surfaces deviations for _future_ commits only.

## R12 — shorten-comment-instead-of-deleting

**Suggested.** Reduce a long comment from N lines to M lines for
"readability".

**Why rejected.** Subjective shortening is the failure mode the
`comment-rot` axis is designed to prevent. The remedy for a comment
that has no WHY-NOT content is **delete**, not trim. The remedy for a
comment that has some WHY-NOT content is **keep that part, delete the
rest**, not "shorten". Findings whose suggested fix is "shorten" are
dropped at triage. _(amended 2026-06-12: per `D17` a partial WHY-NOT that
fails the value test — no real temptation, substitutable by a test/type,
wrong altitude, or rotted — is deleted entirely, not kept-in-part; the fix
is still **delete**, never shorten.)_

## R13 — add-jsdoc-to-internal-helper

**Suggested.** Add `@param` / `@returns` / `@throws` JSDoc to
`<internal helper>` for clarity.

**Why rejected.** The TypeScript type signature already documents
these. JSDoc duplicates the information and rots when the type
changes. Exception: the public surface re-exported from
`src/index.ts` may carry JSDoc — TypeDoc consumes it for the
generated API reference. Internal helpers do not.

## R14 — test-commit-without-src-claimed-as-tdd

**Suggested.** Add a new `test: …` commit covering existing behaviour
"to round out coverage" or "to lock in the contract", with no paired
`src/` change.

**Why rejected.** Per D11, that commit is _developer testing_, not
TDD, and uses the `chore(test):` / `refactor(test):` prefix. The
`test:` prefix is reserved for commits that ship the red phase of a
TDD cycle (paired source change). This rejection does not block the
commit — it routes it to the correct prefix.
