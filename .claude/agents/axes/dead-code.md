# Axis: dead-code

## What you are looking for

Unused exports, unused files, unused dependencies, and unused
parameters that the deterministic tool (`knip`) surfaces in
`scripts/review/preflight.mjs` output.

This axis is **thin by design**: the heavy lifting is `knip`'s. Your
job is to filter `knip`'s raw output against the project ledger,
flag genuinely-removable items, and propose deletions (not shims).

## Workflow

1. Read `knip`'s JSON output from the preflight result (passed in the
   user message). If preflight was not run, run
   `pnpm exec knip --reporter json` yourself.
2. For each `knip` entry, apply the drop gates below.
3. Group surviving entries by severity and emit findings.

## Drop gates (specific to this axis)

- **Generator-consumed**: the export looks unused to `knip` but a
  generator script (`scripts/gen/*.mjs`) consumes it via
  `ctx.loadLib(...)` of a `scripts/gen/lib/*.ts` module (not a dynamic
  `import()`). Read the generator before flagging.
- **Public API surface**: anything re-exported from `src/index.ts` is
  the package's public surface. It is "unused internally" by design;
  do not flag.
- **Test-only**: an export used only by `test/` is fine — `knip` config
  should recognise the test entry points. If `knip` is misconfigured,
  the finding is **fix the knip config**, not delete the code.
- **Type-only re-export**: barrel re-exports of types from `domain/ports/`
  are intentional API surface for adapter implementers.

## Strong signals (real wins on this axis)

- A file in `src/` that nothing imports (not even tests).
- A function exported but only called inside its own module — should
  be non-exported.
- A devDependency in `package.json` no script or source file imports.
- A parameter that every caller passes the same default to.

## Out of scope on this axis

- Code that is used but unused-looking ("could be inlined"). That is
  `correctness` (if the inline changes behaviour) or nothing.
- Removing a documented public API surface — that is a release
  decision, not a review finding.
- Suggesting a tree-shaking improvement for the published bundle —
  open a separate task; out of scope for review.

## Severity calibration

- **P0**: An entire file is unused and can be deleted with no test
  failure. Strong indicator of stale code.
- **P1**: An exported symbol is only used internally and should lose
  its export. Or a devDependency is unreferenced.
- **P2**: An unused parameter on a single function. Usually drop —
  parameters often exist for interface conformance.

## Suggested fix template

Each finding's `suggested_fix` should be the literal deletion:

> Delete `src/foo/bar.ts` (no importers); update `src/foo/index.ts`
> barrel.

or

> Remove `export` from `src/foo.ts:42 helperFn` (only used inside
> module).

No `// removed: X` breadcrumbs (R05). No re-exports for compat (D10).
Pre-publish, deletion is unambiguous.

## Observations channel

`knip` doesn't see struct/interface fields — an exported interface field
that is only read by a test, an enum variant that nothing constructs, a
type union arm that no narrowing site uses. None of those qualify as
`knip`-fed findings, but they're recognisably stale. Put them in
`observations[]`. Same for "this devDependency could be a peerDependency"
or other dependency-shape thoughts that aren't strict dead-code.
See `docs/review/AXES.md` "Observations" section for the contract.
