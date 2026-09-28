# Architecture

siro is one hexagon. `src/core/` contains product decisions and use cases, without
Node, native adapters, reporter implementations or runtime wiring. Consumers use
`src/index.ts`, not internal assembly ports.

```text
CLI / explicit loadConfig / public API → core use cases → core/contracts
                                                            ↑
                                                      driven adapters
runtime.ts → core + driven adapters + evaluation-time clock
```

## Responsibilities and direction

| Area                                           | Responsibility                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `core/contracts/`                              | Closed adapter-facing values, validators and ports; contracts and host-independent libraries only             |
| `core/`                                        | Input validation, common discovery, local target resolution, evaluation and reporting decisions               |
| `core/rules/`                                  | Security intents, explicit built-in scopes and verified availability table                                    |
| `adapters/`                                    | Node FS/paths, contexts, codecs, one exclusion matcher and reporters; contracts/adapters/static metadata only |
| `runtime.ts`                                   | Standard composition and evaluation-time DateTime callbacks                                                   |
| `cli/`, `cli.ts`, `load-config.ts`, `index.ts` | Driving input/config/public facade; inward and outer host dependencies                                        |
| `version.ts`                                   | Static package metadata only                                                                                  |

Contracts include `FileSystem`, `RepositoryPaths`, `CompileExclusions`,
`ConfigCodec`, `IO`, `Reporter`, and the values their implementations need.
Driven adapters never import use-case implementations. `SiroConfig` stays outside
the closed contracts because rule-ID completion depends on the built-in registry.
The architecture gate resolves TS, JS-to-TS, type, re-export, static dynamic and
CommonJS imports; it rejects forbidden directions, unresolved source dependencies,
host imports in core and dynamic module selection in core/driven adapters. This
is not a proof of security or a requirement to preserve file/folder counts.

## Execution and state

1. The CLI imports only cwd's executable config. Library calls never implicitly
   import configuration; `loadConfig` is an explicit opt-in. Child configs are not
   executed. Entry reload does not invalidate Node's imported-dependency cache.
2. `prepareLint` validates options/config, compiles common exclusions once and
   calls `discovery.ts`. Traversal ignores PM declarations, hard-skips `.git` and
   `node_modules`, and prunes excluded directories before reads/enumeration.
   `RepositoryPaths.child` validates native child names without conflating them
   with portable user paths. Directory symlinks are excluded by the FS port.
3. One `RepositoryEvaluation` per selected directory pairs context and parser.
   Discovery validates manifests, including consumed Deno publication metadata before
   applicability; installation roots are validated against exact
   selected directory spelling. Contexts share first successful text reads
   (including absence); parsers share successful `(kind, relative path)` values.
   Manifest validation and codecs share raw bytes. Installation and publication
   reuse the same context. No caches cross directories or lint calls; failures
   propagate. Existence probes remain live: there is no atomic FS snapshot.
4. Targets are resolved locally: root options affect cwd, entry options affect
   their additional root, and other manifests supply only manifest-local evidence.
   Unknown publication targets still receive generic checks. Required installation
   and active custom targets fail if unresolved. Manifest-only directories never
   parse installation configuration just to supply availability checks.
5. `builtinScope` requires an explicit decision for every built-in: installation,
   manifest, or split availability. `manifest-checks.ts` evaluates PM-neutral
   publication checks once without inventing a PM; PM-sensitive alias/availability
   checks use actual local targets. `run-lint.ts` evaluates installation/custom PM
   bindings. Both use `evaluate-binding.ts` for synchronous-response validation,
   violation expansion, severity and finding construction. Manifest dispatch is typed
   against every manifest-scoped built-in, preventing silent registration omissions.
   Availability's manifest and configuration entries have separate owners,
   not string-based finding deduplication. Custom rules run only at cwd.
6. `rebase-finding.ts` copies context-local findings and all automatic operation
   paths into cwd-relative output **after** availability guards. File-less rules
   stay file-less. Manual steps receive child context once. Findings and inspection
   scope are stably ordered, without promising DFS/BFS or a read-event sequence.
7. `lint-command.ts` prepares input, validates reporter selection before executing
   rules, evaluates, computes exit from the full result, filters display findings
   and awaits reporting and tracked IO writes. Reporters receive the explicit scan cwd;
   GitHub resolves annotation paths in its adapter, not in API findings. Human text and
   JSON are encoded at their own presentation boundaries. Filtering preserves inspection. Failures never become
   successful partial reports; reporter failure propagates even after output.
   The CLI classifies expected failures as exit 2 and unexpected failures as 70.

`PreparedLint` separates evaluation inputs from reporter extensions. `lint` stays
synchronous and `lintCommand` asynchronous. Security intents remain grouped by
rule, not PM strategy classes. `VersionNote` is presentation only; default safety
and setting introductions are explicit policy. DateTime callbacks preserve native
npm date parsing and evaluate time when a check runs.

There is no PM workspace declaration expansion, alias resolver, ordered selection,
member parity layer or second legacy scanner. The sole matcher implements siro's
small common directory-exclusion contract.

## Changes and verification

Test observable input scope, generic/PM-specific findings, native and injected FS
safety, local PM/version boundaries, cache reuse, immutable remedy paths and real
API/CLI failure propagation. Do not fix traversal order or unrelated failure order.
Do not expose internal ports solely for private consumers.

`pnpm verify` runs types, lint/format, dead-code checking, generated-doc checking
and behavioral tests. `pnpm test:package` packs and installs the public artifact,
checking strict types, API and executable exits. Documentation generators own
`rules.md`, `comparison.md` and ignored Typedoc output.
