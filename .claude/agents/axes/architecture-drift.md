# Axis: architecture-drift

## What you are looking for

Violations of the hexagonal layering and single-source-of-truth
invariants documented in `docs/review/DECISIONS.md` D01 and `docs/contributing.md`
§"Layering". Drift the static gate (`scripts/check/layers.mjs`) cannot
already see.

## Documented layering (the contract)

**Read `docs/contributing.md` §"Layering"** for the layer responsibilities and
the dependency rule (the single prose source of truth). The enforced data is
`allowedDependencies` in `scripts/check/layers.mjs`; this brief does not restate
the table, so it can't drift from it.

`domain/ports/` declares port contracts (`FileSystem`, `IO`,
`RepoContext`, `Reporter`, `ConfigCodec`). `adapters/` implements them.

## Strong signals

- **Back-edges the gate cannot see**: the static gate's import regexes
  (`STATIC_IMPORT_RE` / `DYNAMIC_IMPORT_RE` in `scripts/check/lib/layers.ts`)
  already match `import type` and string-literal dynamic imports, so those
  do NOT escape it. What still escapes: variable-target dynamic imports
  (`import(somePath)`) and coupling with no import statement at all
  (duplicated literals — see SSOT below). Verify against the gate source
  before claiming a gap. Variable-target dynamic imports are governed by
  D24; only config-loader (user-determined path) and `.mjs → .ts`
  transpilation bridges (jiti) are justified. A new variable-target
  `import()` or `jiti.import()` in `src/` that doesn't meet D24's
  criteria is a P1.
- **SSOT duplication**: a constant or enum defined in two places
  (PM name, severity name, rule id, reporter name). The static gate
  does not catch this — you must grep for the literal across `src/`.
- **Effectful code in pure-domain files**: a function in
  `src/domain/` that calls `fs.*`, `console.*`, `process.*`, or `Date.now()`.
  Domain code may only depend on injected ports.
- **Port surface leaking adapter types**: a port method whose signature
  references a type from `src/adapters/` (e.g., raw `Node.fs.Stats`).
  The port should expose a structural shape from `domain/`.
- **Module-global mutable state**: a top-level `let` or mutable
  `Map` / `Set` that callers mutate. Each command invocation should
  build its own registry / context.
- **Adapter coupling between adapters**: two files in `src/adapters/`
  importing each other instead of going through `domain/ports/`.

## Out of scope on this axis

- Bugs → `correctness`.
- Naming (unless name is wrong, e.g., `FooAdapter` placed in `domain/`) — drop.
- Test isolation issues → `test-brittleness` or `correctness`.
- Documentation drift → `docs-sync`.

## Drop these automatically

- "Move helper to `shared/`" — only if 3+ layers genuinely import it (R03 / R04).
- "Rename layer for clarity" — R09.
- "Add JSDoc to port" — R10.
- Anything `scripts/check/layers.mjs` already flags — re-run the gate
  to verify.

## Severity calibration

- **P0**: Direct layer violation breaks the documented contract AND is
  not caught by the static gate (e.g., back-edge via a type import that
  creates a runtime cycle).
- **P1**: SSOT duplication, port leaking an adapter type, mutable
  module-global. Risk of silent drift but not currently broken.
- **P2**: Almost always drop on this axis. Architecture drift is either
  there or not.

## Strong evidence required

A finding must name:

1. The exact violating import / declaration (`file:line`).
2. The specific DECISIONS / contributing rule it breaks.
3. Why the static gate did not catch it (so the maintainer can
   consider whether to extend the gate).

Without all three, drop.

## Observations channel

Drift-adjacent smells that don't qualify as P0/P1 findings — adapter
imports forming an internal graph that's defensible but worth watching,
a shared constant that's currently SSOT but could drift if one site
changes, a port surface that's clean today but typed in a way that
admits adapter leakage — go in `observations[]`. The OBSERVATIONS.md
ledger accumulates them across rounds. Do not pad; only emit
observations you actually noticed. See `docs/review/AXES.md`
"Observations" section for the contract.
