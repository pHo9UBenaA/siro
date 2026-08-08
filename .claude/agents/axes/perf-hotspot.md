# Axis: perf-hotspot

## What you are looking for

Performance regressions in code paths exercised by `bench/lint.bench.ts`,
evidenced by a measurable drop versus the
recorded baseline.

**No measurement, no finding.** This is the strictest evidence
requirement of any axis.

## Required evidence

Every finding on this axis must include:

1. The bench row (`bench-row` format) showing the regression, with
   ops/sec and ms/op for both current and baseline.
2. A profile-level explanation of where the time goes (allocations in
   a hot loop, an O(n²) scan, a synchronous codec call that could be
   cached, repeated parses of the same string).
3. The proposed fix's expected impact, measured if possible.

A finding that reads "this loop could be O(n)" with no bench number
attached is dropped.

## Strong signals (places to measure first)

- **Codec round-trips inside a loop**: parsing the same `.npmrc` /
  `bunfig.toml` once per rule rather than once per command.
- **Regex compilation in hot paths**: a `new RegExp(...)` inside a
  per-finding loop.
- **Repeated FS reads of the same file**: a rule binding that re-reads
  `package.json` because it does not use `ctx.packageJson`.
- **Synchronous reads with no caching**: `readFileSync` in a path that
  the lint command will hit thousands of times for monorepos.
- **Unnecessary structuredClone / JSON round-trips**: deep-cloning
  configuration for safety when the consumer does not mutate.

## Out of scope on this axis

- Speculative micro-optimisations ("this `.map` could be a `for` loop"
  without a bench).
- Memory usage in test or bench fixtures.
- Build-time / typecheck performance (`tsc` cold-start, `tsdown`).
- CLI startup latency unless `bench/` covers it.

## Drop these automatically

- Findings with no bench number — always.
- "Add a cache" with no evidence the path is hot.
- "Use Set instead of Array" without a size argument.
- Anything `tinybench` would report as within noise (≤ 5 % difference
  between current and baseline at the documented warmup / measure
  settings).

## Severity calibration

- **P0**: ≥ 25 % ops/sec drop versus baseline on a row representative
  of typical use (single-package or monorepo).
- **P1**: 10–25 % drop, OR a regression on a niche fixture, OR a hot
  path with a clear O(n²) shape and a fixable algorithm.
- **P2**: Drop on this axis. Sub-10 % differences are noise.

## Baseline location

The current baseline lives in `docs/review/DECISIONS.md` (add an entry
when a measurable improvement lands; reference the row name and the
date). If no baseline exists for the regressed row, the first
"finding" on that row is **establish a baseline**, not a fix.

## Observations channel

This axis is the strictest about evidence, so it produces the most
"I think this could be faster but can't prove it" dropped thoughts.
Those go in `observations[]`: e.g. "an allocation in a per-binding
loop is fine at current scale but would matter at 100× rules",
"this regex is recompiled per call but only called once per command —
worth a future profile if rule counts grow". See `docs/review/AXES.md`
"Observations" section for the contract.
