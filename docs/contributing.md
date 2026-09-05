# Contributing

## Setup

The project requires **Node `^22.18.0 || ^23.6.0 || >=24.0.0`** (matching `engines.node` in `package.json`)
and **pnpm 10.33+** (matching `packageManager` in `package.json`).
Dependency versions are managed through a pnpm catalog in `pnpm-workspace.yaml`.

```sh
pnpm install
```

Development tooling assumes a POSIX shell. Windows development is unsupported — use WSL.

Point git at the repo-local hooks once after cloning:

```sh
git config core.hooksPath .githooks
```

See [`.githooks/README.md`](../.githooks/README.md).

## Commands

```sh
pnpm test            # vitest
pnpm test:coverage   # vitest + v8 coverage
pnpm typecheck       # tsc --noEmit (src + test) + layering check
pnpm check           # oxlint + oxfmt (lint + format check)
pnpm format          # oxfmt --write
pnpm build           # gen:version + tsdown -> dist/
pnpm gen:rule <id>   # scaffold a new rule (--advisory for AdvisoryRuleBinding)
pnpm gen:rules       # regenerate docs/rules.md from the registry
pnpm gen:comparison  # regenerate docs/comparison.md from the registry
pnpm gen:version     # regenerate src/version.ts from package.json
pnpm gen:api         # TypeDoc → docs/api/ (on-demand; not committed)
pnpm gen             # run all generators (version + comparison + rules + api)
pnpm bench           # tinybench over in-memory fixtures (bench/lint.bench.ts)
pnpm knip            # dead code / unused dependency check
```

Reproduce defects with a failing behavior test, fix them, then simplify while keeping
observable behavior covered. Include malformed inputs, defaults, precedence, and
failure paths where they affect the contract. Linting checks correctness and
suspicious constructs; function length, literal values, and ordinary TypeScript
syntax are not design constraints.

## Testing conventions

`pnpm bench` measures the lint pipeline with in-memory files; it excludes Node
startup and disk I/O. The 50-entry workspace fixture measures the root manifest,
not traversal of child packages. For comparisons, freeze both source trees, use
the same Node and dependencies, and collect at least three alternating runs with
`BENCH_JSON=1 pnpm bench`. Compare per-fixture medians, not one run. Measure the
built bin separately for `--help`, `--version`, and disk lint with and without an
executable config; check exit codes and report warmups, sample counts, and p50/p95.

Three FS patterns coexist in `test/`, and the right one depends on what
boundary the test crosses:

- **memfs (in-memory)** — every test that drives a `FileSystem`-port
  consumer (rule bindings, `lintCommand` in unit form)
  uses the `createMemFileSystem()` helper in `test/helpers/memfs.ts`. The port
  abstraction makes this transparent and keeps the suite fast.
  Other helpers: `ctx.ts` (repo-context stubs), `fixtures.ts` (test fixture loaders),
  `io.ts` (IO stubs), `github-annotation.ts` (GitHub reporter test helpers),
  `binding-expectations.ts` (rule-binding assertion helpers).
- **`mkdtempSync` + real FS** — integration and adapter tests that need a
  real path on disk (notably `test/adapters/config-loader.test.ts` plus
  mutation cases in `test/e2e.test.ts`) spawn a temp directory.
  This is because `adapters/config-loader.ts` imports
  `siro.config.{ts,mjs,js}` through Node's module loader, which resolves
  against the real filesystem — there is no `FileSystem`-port hook there
  by design, because the relevant "port" is Node's module loader, not its
  FS API.
  Each tmpdir test cleans up in `afterEach`.
- **`spawnSync` against the declared `package.json#bin`** — `test/cli.subprocess.test.ts`
  drives the published binary so packaging regressions (shebang,
  exit-code routing, module bundling) surface. The block is gated via
  `describe.skipIf(!existsSync(DIST_BIN))` so a clean checkout silently
  skips it; CI and prepublish build before testing so the
  packaged binary is always exercised there.

Committed fixtures under `test/fixtures/` cover npm, pnpm, Yarn, Bun, and Deno
with a `-good` shape (and `npm-bad` for failure-path coverage). The pnpm, yarn, and bun
end-to-end suites read their `-good` fixtures directly. They are read-only —
tests that need to mutate a fixture mkdtemp + write inline rather than
copying the committed tree, to keep the tree's intent (a known-clean
or known-broken repo) tamper-evident in git.

### API reference (TypeDoc)

`pnpm gen:api` produces a Markdown reference under `docs/api/`. The
output is gitignored on purpose — generated documentation drifts in
diffs and crowds review. Run it locally when you need it; CI deployment
to the project site is a future-work item.

## Layering

```
cli         → application, adapters, domain, shared
application → domain, shared
adapters    → domain, shared
domain      → shared
shared      → (nothing)
```

`domain/` declares both the structural types and the port contracts (`FileSystem`, `IO`,
`RepoContext`, `Reporter`, `ConfigCodec`) under `domain/ports/`; `adapters/` implements
them by TypeScript structural typing. Pure value types live under `domain/entities/`,
pure transforms under `domain/services/`. Application and adapters are siblings — both
depend on the port contracts in `domain/` and never on each other, except for the
composition roots in `application/` — `application/commands/lint.ts`
and its shared preamble `application/prepare-context.ts` — which may import concrete
adapters to wire them (see the `allowList` in `scripts/check/layers.mjs`).

The domain may use pure parsing libraries (`valibot`, `semver`) without an I/O
port. The semver parser replaces a local approximation of registry-version syntax.

Placement by responsibility:

- **adapters/** — implements a port for a concrete runtime, format, or sink (Node FS,
  config loader, codec, reporter).
- **application/** — orchestrates a multi-port flow on behalf of a CLI command
  (`runLint`, `assertConfigRuleIdsKnown`, `lintCommand`).
- **domain/** — everything else that depends only on port abstractions: rule definitions,
  pure transforms, registries, projections, and ctx-only predicates such as `detectPMs`,
  `isPublishable`, and `createConfigParser`. ctx alone does not move code out of domain — it
  is itself a port contract.
- **shared/** — primitives reachable from every layer (`AbsPath`/`RelPath`, error classes).

`scripts/check/layers.mjs` enforces this with a whitelist of (source layer → allowed
target layers); the file-level escape hatches are `application/commands/lint.ts` and its shared preamble
`application/prepare-context.ts`, all of which may import from `adapters/`. The public-API barrel
`index.ts` may be imported only by `cli` (importing it would otherwise pull every layer in
transitively); `version.ts` is a re-export-less leaf and any layer may import it.

The runtime flow is `lintCommand → prepareRun → runLint → reporter`.
`applyConfig` selects rules and records severity overrides; `runLint` resolves
user, dynamic, binding, and rule severity in that order. Its command-scoped
parser caches each `(format, path)` once. Keep these decisions visible in the
calling code instead of introducing wrappers solely to shorten functions.

Build and documentation tools live in `scripts/`; runtime benchmarks live in
`bench/`. Passing static checks does not establish that all relevant input and failure
cases were examined.

A **rule** is a security intent with a `bindings` map of PM → `RuleBinding`. Each binding has
`check` (pure, reports violations), `fix` (returns `FixOp`s), and a static `fixKind` (`auto` or
`advisory`). `lint` calls `check` and embeds each binding's `fix` ops in the finding (machine-readable remediation; see docs/json-output.md). Absence of a PM in
`bindings` means N/A.

## Adding a rule

The fastest path is `pnpm gen:rule <id>`, which creates the rule file, registers
it in the ordered array in `src/domain/builtin-rules.ts`, and regenerates the
docs in one shot:

```sh
pnpm gen:rule frozen-lockfile             # AutoRuleBinding (requireConfigKey)
pnpm gen:rule files-field --advisory      # AdvisoryRuleBinding (custom check)
```

Then:

1. Open `src/domain/rules/<id>.ts` and fill in `title`, `description`, `severity`,
   `docs`, and per-PM `bindings`. Worked examples: `src/domain/rules/frozen-lockfile.ts`
   (auto) and `src/domain/rules/files-field.ts` (advisory).
2. If the rule is "this key must equal this value", `requireConfigKey` from
   `src/domain/rules/builders/` is enough — most rules are this shape.
3. Cover the rule at all three layers siro uses: a per-rule unit test under
   `test/domain/rules/<id>.test.ts`, an entry in the matching per-PM sweep
   (`test/domain/rules/<pm>-bindings.test.ts`), and a fixture under
   `test/fixtures/` exercised from `test/lint.test.ts` / `test/e2e.test.ts`.
   The three scopes pin different invariants (rule-internal logic, per-PM
   binding shape, end-to-end behaviour) and are not redundant.
4. Re-run `pnpm gen:rules && pnpm gen:comparison` after editing so the
   generated docs match the new bindings. `test/scripts/doc-generator.test.ts`
   catches any drift.

If you skip `gen:rule`, the manual equivalent is: create the rule file, import
it into the ordered `rules` array in `src/domain/builtin-rules.ts`, and
regenerate the docs. `BuiltinRuleId` is derived from the array's literal rule
IDs, so there is no separate ID list to update.

CLI, reporters, and the lint engine need no changes.

### Picking a severity per PM

The rule's top-level `severity` is the default. Override it on a binding when one PM is
informational by design:

- **Static `spec.severity`** — the PM enforces the intent _outside_ this key, so the key is
  advisory. Example: `disable-lifecycle-scripts × bun` is hard-coded to `'info'` because Bun
  1.3+ blocks postinstall via runtime defaults independent of `install.ignoreScripts`.
- **`documentedDefault`** — the key's _own_ default already satisfies the rule. The builder
  emits an `info` finding for unset keys, telling the user "the PM default covers you, but
  pin it explicitly". Examples: `disable-lifecycle-scripts × yarn` (`enableScripts: false`),
  `minimum-release-age × aube` (`minimumReleaseAge: 1440`).
- **Both apply** — prefer `documentedDefault`; static `severity` cannot distinguish "unset
  but safe by default" from "user explicitly weakened it".

`frozen-lockfile × aube` instead uses an unconditional `info` advisory for
`aube ci` or `aube install --frozen-lockfile`; `preferFrozenLockfile` is only a preference.

### Hand-written bindings

`requireConfigKey` models an expected primary value with optional additional required keys.
When the decision needs richer logic,
construct an `AutoRuleBinding` (or `AdvisoryRuleBinding` for advisory fix ops) directly and
splice it into the rule with the spread pattern. Worked examples:

- **Multi-key check** (`disable-lifecycle-scripts × pnpm`): inspects `strictDepBuilds` _and_
  `dangerouslyAllowAllBuilds`; the bypass wins over the safe key.
- **Per-entry value iteration** (`pin-exact-versions × deno`): walks every entry under
  `deno.json#/imports` and aggregates offenders into a single finding. `fix` returns an
  advisory note since the binding can't rewrite individual specifiers.

Extract a shared builder when the bindings have the same semantics and the abstraction
reduces the work needed to understand them. Similar syntax alone is insufficient.

### aube rule-adoption policy

Add an aube binding when it addresses a concrete supply-chain risk and its setting is covered by
authoritative upstream documentation. Prefer symmetry with another package manager, but allow an
aube-specific control when the risk is relevant to configuration linting. Runtime-only behavior
without a configurable policy remains out of scope.

## Adding a package manager

1. Add the name to the `PMS` tuple in `src/domain/entities/pms.ts`.
2. Add its signals to `src/domain/entities/signals.ts` (`lockfiles`, `configs`).
3. If it uses a new config format, add a codec in `src/adapters/codecs/` and register it in
   `store.ts`. Otherwise reuse an existing codec.
4. Fill in `bindings.<pm>` on the rules that apply; omit the rest (they become N/A).
5. `pnpm gen:comparison`.

[`aube`](https://github.com/endevco/aube) is wired up exactly this way — see its bindings in the rule files for a worked end-to-end example.
