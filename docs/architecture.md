# Architecture

siro is a single hexagon, not a hierarchy of DDD entities and services. `src/core/`
contains the product's decisions and use cases. It does not import Node, the glob
engine, the reporter implementations, or the standard runtime wiring. The public
package entry remains `src/index.ts`; consumers do not assemble internal ports.

```text
CLI / explicit loadConfig / public API  ──▶  core use cases
                                              │
                                              ▼
                                        core/contracts
                                              ▲
                                              │
                                     driven adapters

runtime.ts ──▶ core + driven adapters (standard wiring and evaluation-time clock)
```

## Responsibilities and dependency direction

| Area                                           | Responsibility                                                                            | Source dependencies                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `core/contracts/`                              | Adapter-facing ports, public values, schemas, and pure validators                         | Other contracts and host-independent computation libraries                                  |
| `core/` outside `contracts/`                   | Input selection, rule evaluation, PM policy, workspace discovery, and reporting decisions | Core and contracts, never outer implementations                                             |
| `core/rules/`                                  | Security intents with PM-specific bindings and setting availability                       | Core and contracts                                                                          |
| `core/workspaces/`                             | PM declaration policy, selection, traversal, member-context preparation                   | Core and contracts; traversal invokes supplied FS/glob ports                                |
| `adapters/`                                    | Driven Node filesystem/paths, repository context, config codecs, glob engine, reporters   | Other adapters, contracts, and static version metadata; never core use-case implementations |
| `runtime.ts`                                   | Standard dependencies, built-in rule clock, and public `lint`/`lintCommand` wiring        | Core and adapters                                                                           |
| `load-config.ts`, `cli/`, `cli.ts`, `index.ts` | Executable-config import, CLI driving adapter, public facade                              | Inward dependencies and outer host helpers                                                  |
| `version.ts`                                   | Static package metadata                                                                   | `package.json` only                                                                         |

`core/contracts/` is a _closed_ adapter-facing boundary. It contains both output
ports (`FileSystem`, `WorkspaceGlobs`, `ConfigCodec`, `Reporter`, `IO`) and the
values their implementations need (`PackageJson`, `ParsedConfig`, `LintResult`,
paths, PMs, errors, and `Rule`). For example, the repository adapter uses the
pure `parsePackageJson` validator and codecs use `toParsedConfig`. Placing those
alongside ports avoids an adapter-to-use-case import or a filename allowlist.
Contracts cannot import other core implementations, including via type imports
or re-exports. `SiroConfig` is not in this closed group: its built-in rule ID
completion depends (type-only) on the actual rule registry. The outer driving
`load-config.ts` may call the shared core validator; driven adapters may not call
a lint use case. Public `Rule`, `SiroConfig`, and reporter types are still
exported only through the package entry point.

The architecture test resolves TypeScript imports, including type imports,
re-exports, static dynamic imports and `.js` references to `.ts` sources. It
checks dependencies among these areas, metadata access and unresolved local
imports. It forbids host built-ins and dynamic module selection in core, and
adapter-to-core-implementation references. It does not impose a particular file
count, ban same-area cycles, inspect third-party internals, or prove PM behavior.
Runtime calls from core through a supplied output port do not reverse the source
dependency direction.

## Execution and state

1. CLI input parsing is a driving operation. The CLI automatically finds and
   imports `siro.config.*` through `load-config.ts`. The exported `loadConfig`
   also imports executable configuration **when explicitly called**. Library
   `lint` and `lintCommand` accept config as a value and never discover or
   execute target-repository config files themselves.
2. `runtime.ts` supplies the standard FS, paths, codecs, glob engine, reporter
   registry and clock callbacks. `core/lint.ts` validates input, resolves PMs,
   versions and rules, and prepares root/member contexts. It accepts a caller's
   `FileSystem` in place of the standard one without a host fallback.
3. `core/run-lint.ts` evaluates each applicable rule binding and builds findings.
   A parser is lazy and belongs to **one repository context in one lint call**.
   Workspace declarations, Deno vendor selection, nested checks and rule reads
   of the same `(kind, relative path)` share its first successfully parsed value
   (including an absent file). Root and each member have distinct parsers; a new
   lint call builds fresh contexts. The first read/parse failure propagates and
   is not cached. This is not a filesystem-wide atomic snapshot: existence
   checks remain live, and independent paths need not describe one instant.
   Each context also reads its `package.json` raw text once for both manifest
   validation and rule parsing.
4. `core/lint-command.ts` prepares input, validates the selected reporter,
   evaluates, computes an exit status from the full result, filters display
   findings, and awaits reporter output through `IO`. Reporter rejection
   propagates. `cli.ts` classifies expected failures and owns process exit.

Workspace declaration sources remain PM-specific. `core/workspaces/declarations.ts`
validates them; `selection.ts` compiles inclusion, exclusion and descent policy;
`walk.ts` lists ordinary directories using the supplied FS; `members.ts` builds
restricted child publication contexts. Selection passes both the actual directory
and whether a positive native Deno literal selected it. Member construction does
not reinterpret the declaration spelling to rediscover that fact. Positive Deno
prefixes may use the injected resolver; negative paths remain lexical. Bun's
ordered glob pass, npm's exclusion cancellation, Deno's two declaration sources,
Aube's limited matcher, directory sorting and failure order retain their distinct
semantics. No PM-specific walker or repository-wide directory cache is introduced.

Security intents remain grouped by rule, not by PM. `DateTime.now()` reads epoch
milliseconds at evaluation time; `DateTime.parse()` retains native parsing,
including the host timezone for offsetless npm cutoffs. The built-in publication
IDs selected in `core/lint.ts` run on members; custom rules and installation
policy remain root-only. Member remediation is only proposed, never applied.

## Changes and verification

Keep contracts small and describe absence and failures where they are produced.
Do not add internal ports to the public package solely for private consumers. To
change workspace semantics, test declaration selection, real adapter behavior,
public API and CLI failure propagation separately. In particular, a Deno literal
resolved via a native alias must retain its explicit-member status when checking
for a missing manifest; this is different from a negative path's lexical match.

`pnpm verify` includes typecheck, lint/format, dead-code checking, generated rule
docs and behavioral tests. `pnpm test:package` tests the packed, installed API,
strict exported types and the executable's exit codes. The direction gate is not
an architectural verdict by itself: verify API/CLI output, rule ordering, error
propagation and PM behavior as well. Keep the public facade, JSON schema,
synchronous `lint`, asynchronous `lintCommand`, public `loadConfig` semantics and
child publication scope stable during internal relocation.
