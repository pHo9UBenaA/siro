# Contributing

## Setup

The project requires **Node 20+** (matching `engines.node` in `package.json`)
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

The project follows TDD: write a failing test, make it pass, refactor, commit.

## Testing conventions

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
  `test/{e2e,pnpm,yarn,bun}.test.ts`) spawn a temp directory.
  This is because `adapters/config-loader.ts` uses `jiti` to import
  `siro.config.{ts,mjs,js}`, and jiti resolves modules against the real
  filesystem — there is no `FileSystem`-port hook there by design,
  because the relevant "port" is Node's module loader, not its FS API.
  Each tmpdir test cleans up in `afterEach`.
- **`spawnSync` against `dist/cli.mjs`** — `test/cli.subprocess.test.ts`
  drives the published binary so packaging regressions (shebang,
  exit-code routing, jiti bundling) surface. The block is gated via
  `describe.skipIf(!existsSync(DIST_BIN))` so a clean checkout silently
  skips it; CI / post-`pnpm build` runs exercise it.

Committed fixtures under `test/fixtures/` cover each PM with a `-good`
shape (and `npm-bad` for failure-path coverage). They are read-only —
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

Placement by responsibility:

- **adapters/** — implements a port for a concrete runtime, format, or sink (Node FS,
  jiti loader, codec, reporter).
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

```
src/
  cli.ts                   cac parsing, exit-code mapping, composition root
  cli/
    cac-bridge.ts          wraps cac for testable output (avoids process.exit)
    commands.ts            command-name tuple + per-command flag scopes
    flags.ts               KNOWN_FLAGS catalog + per-command flag gating
    help.ts                shared --help / --version text (single SSOT)
    parsers.ts             flag value parsers (--pm, --severity, --reporter, …)
    scanners.ts            pre-parse --help / --version detection
  index.ts                 public API barrel
  version.ts               generated by scripts/gen/version.mjs

  shared/                  Shared Kernel — vocabulary referenced from every layer
    paths.ts               AbsPath / RelPath branded types
    errors.ts              SiroError / UsageError / ConfigError, wrapCodecError
    config-error.ts        ConfigError subclass
    siro-error.ts          SiroError base class (message + exitCode)
    usage-error.ts         UsageError subclass

  domain/                  pure types + port contracts + ctx-only domain services
    builtin-rules.ts       Record<BuiltinRuleId, Rule> registry + `rules` projection
    entities/              pure value types
      pms.ts               PM / Severity tuples
      signals.ts           PM_SIGNALS (lockfile + config-file map per PM)
      config-files.ts      CONFIG_FILES (canonical ConfigFileRef per PM config file)
      lint-result.ts       Finding / LintResult / ConfigReadValue
      rule.ts              Rule / RuleBinding / FixOp / CheckStatus / ConfigFileRef
      rule-id.ts           BUILTIN_RULE_IDS / BuiltinRuleId
      config-value.ts      ConfigScalar / ConfigValue / ParsedConfig + getByPath
      siro-config.ts       SiroConfig / RuleSetting / defineConfig
    ports/                 I/O abstraction contracts
      file-system.ts       FileSystem
      io.ts                IO
      reporter.ts          Reporter<Name>
      repo-context.ts      RepoContext
      config-codec.ts      ConfigCodec / CodecFor / CodecKind
    services/              pure transforms / port-only domain operations
      apply-config.ts      applyConfig (Rule[] × SiroConfig)
      validate-rule-ids.ts validateRuleIds (Rule[] × SiroConfig duplicate / unknown check)
      decide-severity.ts   resolves binding/static/dynamic severity into one Finding level
      evaluate-bindings.ts runs every applicable binding for a rule × PM pair
      merge-programmatic-rules.ts  splices customRules over builtin rules with dedup
      resolve-pms.ts       reconciles --pm, siro.config.pms, and detectPMs results
      filter.ts            filterBySeverity / exitCodeForLint
      detect-pms.ts        detectPMs (reads ctx.exists / ctx.packageJson)
      parse-config-file.ts createConfigParser / ConfigParser (factory; parseCache aware)
    schemas/               valibot schemas (package.json)
    rules/                 one file per rule + builders/require-config-key.ts
      publishable.ts       `isPublishable` predicate shared by files-field / publish-access

  application/             use cases — multi-port orchestrators only
    commands/              lint.ts — composition root for the lint command
    prepare-context.ts     prepareRun — shared lint preamble (config → ctx → pms → ruleSet)
    run-lint.ts            runLint
    validate-config-rules.ts  assertConfigRuleIdsKnown (fail-fast on unknown rule ids)

  adapters/                implementations of domain port contracts
    node-file-system.ts    nodeFileSystem + resolveIn
    node-errors.ts         isNodeError (Node-runtime type guard)
    node-io.ts             nodeIO
    config-loader.ts       loadConfig (jiti-backed)
    repo-context.ts        createRepoContext (factory wrapping FileSystem)
    codecs/                ini / yaml / toml / json codecs + store (codecFor)
    reporters/             pretty / json / github + createRegistry, BUILTIN_REPORTER_NAMES

scripts/                   build-time tooling (not bundled into dist)
  _shared/                 cross-context utilities (script-runtime: root/name/jiti)
  check/                   `pnpm typecheck` extension
    layers.mjs             driver — enforce layering contract under src/
    lib/layers.ts          pure layer-check logic (string-in / string-out)
  gen/                     `pnpm gen:*` family
    rule.mjs               scaffold a new rule (--advisory for AdvisoryRuleBinding)
    rules.mjs              regenerate docs/rules.md
    comparison.mjs         regenerate docs/comparison.md
    version.mjs            regenerate src/version.ts from package.json
    lib/
      doc-generator.ts     renderRulesDoc + renderComparison (registry → Markdown;
                           reads src/ directly, so docs reflect source not dist/)
      rule-scaffolder.ts   pure transforms used by gen/rule.mjs
      rule-paths.mjs       rollback-message path shortener
      rule-rollback.mjs    LIFO restorer for partial scaffold writes
      version.ts           readPackageVersion + renderVersionModule
  bench/                   `pnpm bench`
    run.mjs                sequentially runs every bench/*.bench.ts

bench/                     tinybench harness (in-memory fixtures)
  lint.bench.ts            lint loop over the per-PM `-good` fixtures
  bench-row.ts             tinybench result formatter (per-row stats)
```

A **rule** is a security intent with a `bindings` map of PM → `RuleBinding`. Each binding has
`check` (pure, reports violations), `fix` (returns `FixOp`s), and a static `fixKind` (`auto` or
`advisory`). `lint` calls `check` and embeds each binding's `fix` ops in the finding (machine-readable remediation; see docs/json-output.md). Absence of a PM in
`bindings` means N/A.

## Adding a rule

The fastest path is `pnpm gen:rule <id>`, which creates the rule file, registers
the id in `BUILTIN_RULE_IDS`, splices the import + entry into
`src/domain/builtin-rules.ts`, and regenerates the docs in one shot:

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

If you skip `gen:rule`, the manual equivalent is: create the rule file, add an
entry to `RULE_REGISTRY` in `src/domain/builtin-rules.ts`, add the id to
`BUILTIN_RULE_IDS` in `src/domain/entities/rule-id.ts` (the
`Record<BuiltinRuleId, Rule>` constraint fails to compile if either side is
out of sync), and regenerate the docs.

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
  `frozen-lockfile × aube` (`preferFrozenLockfile: true`),
  `minimum-release-age × aube` (`minimumReleaseAge: 1440`).
- **Both apply** — prefer `documentedDefault`; static `severity` cannot distinguish "unset
  but safe by default" from "user explicitly weakened it".

### Hand-written bindings

`requireConfigKey` only models "one key = one value per binding". When you need richer logic,
construct an `AutoRuleBinding` (or `AdvisoryRuleBinding` for advisory fix ops) directly and
splice it into the rule with the spread pattern. Worked examples:

- **Multi-key check** (`disable-lifecycle-scripts × pnpm`): inspects `strictDepBuilds` _and_
  `dangerouslyAllowAllBuilds`; the bypass wins over the safe key.
- **Per-entry value iteration** (`pin-exact-versions × deno`): walks every entry under
  `deno.json#/imports` and aggregates offenders into a single finding. `fix` returns an
  advisory note since the binding can't rewrite individual specifiers.

If a second binding wants the same shape, extract a builder (`inspectConfigValues`) instead of
copy-pasting. Until then, hand-writing is fine (YAGNI).

### aube rule-adoption policy

aube ships several strict defaults beyond `jailBuilds` (`blockExoticSubdeps`, `trustPolicy`,
`verifyStoreIntegrity`, `paranoid`, `advisoryCheck`, …). The current policy is **bind
`jailBuilds` and stop** — postinstall RCE is the highest-impact supply-chain failure mode, and
aube already enforces the rest at runtime. Adding more aube-only bindings requires:

1. A concrete attack scenario the current bindings miss.
2. Symmetry with at least one other PM (don't add aube-only hardening that has no analogue
   elsewhere — it's a configuration linter, not an aube tutorial).

`advisoryCheck` (CVE scanning) is explicitly out of scope: siro checks configuration, not
running databases. Use `npm audit` / `osv-scanner` for that layer.

## Adding a package manager

1. Add the name to the `PMS` tuple in `src/domain/entities/pms.ts`.
2. Add its signals to `src/domain/entities/signals.ts` (`lockfiles`, `configs`).
3. If it uses a new config format, add a codec in `src/adapters/codecs/` and register it in
   `store.ts`. Otherwise reuse an existing codec.
4. Fill in `bindings.<pm>` on the rules that apply; omit the rest (they become N/A).
5. `pnpm gen:comparison`.

[`aube`](https://github.com/endevco/aube) is wired up exactly this way — see its bindings in the rule files for a worked end-to-end example.
