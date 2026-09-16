# Architecture

siro uses ports and adapters. Its application evaluates repository policy without
selecting a filesystem, parser, reporter, clock, or host platform. The public Node
API supplies the standard implementations, so callers still use `lint(options)`
and `lintCommand(options, io)` without assembling internal dependencies.

## Dependency direction

The hexagon contains application use cases, domain policy and their ports. The CLI
is a driving adapter; filesystem, codecs, glob matching and reporters are driven
adapters. Composition is outside the hexagon and supplies concrete implementations.
These are source dependencies, not the chronological order of execution:

```text
                         inside the hexagon
CLI / public facade ---> application use cases ---> domain policy
                                |                       |
                                v                       v
                         application ports        domain ports
                                ^                       ^
                                |                       |
                         concrete adapters (outside)

composition (outside) ---> use cases + concrete adapters
shared <--- core and outer modules
```

Ports belong to the core responsibility that needs them. Use-case functions are
input ports; an extra interface/class is not required around each function. During
execution the core calls supplied output ports, which dispatch to adapters. That
outward call does not create an outward source dependency.

| Area                         | Responsibility                                                                                | Allowed internal dependencies                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `shared/`                    | Errors, records, branded path types and relative-path validation                              | Shared                                                                |
| `domain/`                    | Rules, PM bindings, configuration validation, severity, version availability and domain ports | Domain, shared                                                        |
| `application/ports/`         | Host-neutral contracts for application operations                                             | Application ports, domain, shared                                     |
| `application/` (other files) | Input validation, PM/workspace selection, evaluation and reporting use cases                  | Application, application ports, domain, shared                        |
| `adapters/`                  | Node filesystem/paths, configuration import, codecs, glob engine and output formats           | Adapters, application ports, domain, shared                           |
| `composition/`               | Connect standard adapters and time-dependent rules                                            | Composition, adapters, application, application ports, domain, shared |
| `cli/`, `cli.ts`, `index.ts` | CLI driving adapter and public package facade                                                 | Inward dependencies; never imported by the core                       |

Driven adapters must not import application implementations. The config loader
imports domain configuration validation, shared with the library use case. The
path adapter imports only its small `RepositoryPaths` contract, not the aggregate
lint dependency contract.

**All statically resolved internal source dependencies must form a directed
acyclic graph, including type imports and re-exports within the same layer.**
This is an explicit siro maintenance constraint in addition to the hexagonal
boundary. `ConfigFileRef` lives in an independent domain value module: both rules
and repository ports depend on it, rather than depending on each other. Built-in
rule ID completion is derived from the rule registry as a type-only dependency;
this keeps one source of truth without introducing a cycle.

`version.ts` exposes static package metadata. It is not a runtime dependency
provider. The core permits `semver` and `valibot` for computation and validation;
format, filesystem and glob libraries remain in adapters. The architecture test
uses TypeScript module resolution, including `.js` references to `.ts` sources,
before checking direction and cycles. It rejects unresolved local references,
checks imports/re-exports (including types and static dynamic imports), known host
globals, and dynamic module selection in the core. Executable user configuration
is intentionally loaded dynamically by the outer config adapter. The test does
not inspect third-party library internals or sandbox user code.

## Execution and ports

1. The CLI parses arguments and explicitly loads `siro.config.*`. Library `lint`
   receives configuration as a value and never imports target configuration code.
2. `composition/lint.ts` supplies `LintDependencies`. `composition/rules.ts` binds
   the clock to the built-in rule factory. `application/lint.ts` validates options,
   resolves PMs and versions, and prepares root/member contexts through these ports.
3. `runLint` uses `RepoContext` and `CodecFor` to evaluate bindings. Parsed settings
   are cached within each evaluation. Findings and their order remain independent
   of reporter selection.
4. The command use case selects from the supplied reporter registry, computes the
   exit status from all findings, and awaits output through `Reporter` and `IO`.
   Reporter rejection propagates; the CLI classifies errors and owns process exit.

`FileSystem` distinguishes absence from failure: only ENOENT is absent; other
errors and non-file entries propagate. Workspace discovery requires directory
operations on the supplied filesystem and never falls back to the host filesystem.
`RepositoryPaths` separates native absolute paths from POSIX workspace patterns.
`WorkspaceGlobs` supplies bounded expansion, membership and traversal predicates;
the application owns PM syntax policy, inclusion order and member scope.
The glob port distinguishes declaration comparison from directory matching and
expresses case, punctuation, hidden-directory and extended-pattern behavior.
Minimatch options, optimization and literal-bracket escaping stay in its adapter.
The explicit case policy preserves the host's existing glob behavior. Native
literal-directory resolution is a separate filesystem operation.

The domain owns release-age policy. `DateTime.now()` supplies current epoch
milliseconds at evaluation time. `DateTime.parse()` supplies native parsing, including the host timezone for
offsetless npm cutoffs; explicit UTC arithmetic stays in the domain. This preserves
the existing JavaScript semantics. Tests can supply a fixed clock without patching globals.
No new clock or glob injection surface is added to the public API.

PM-specific policy is part of siro's purpose: adding a PM binding does not imply
moving that policy to an adapter. Similarly, workspace root installation policy
and child publication policy remain separate. Remediation is a proposal; this
architecture does not add file-writing capabilities.

## Changing and verifying boundaries

Put a port with the core responsibility that needs it. Keep contracts small and
state absence, failures and ownership. Use functions and explicit dependencies;
a DI container or a class per use case is unnecessary. Standard wiring belongs
in composition, never in core defaults or a shared module that imports adapters.

- Core tests supply ports and verify decisions, precedence, failures and isolation.
- Adapter tests exercise parsing, filesystem semantics and output contracts.
- Composition/API/CLI tests exercise real wiring, trust boundaries and exit codes.
- `pnpm verify` includes the graph/direction gate and behavioral tests. Gate
  examples cover type cycles, transitive cycles, shared acyclic dependencies,
  module resolution, and adapter-to-use-case violations.
- `pnpm test:package` checks installed exports, types and the executable. Source
  imports alone do not establish package compatibility.

Keep the public exports, synchronous `lint`, asynchronous `lintCommand`, JSON
schema, error categories and PM semantics stable during structural refactors.
Private consumers must use the built package entry point; they must not import
internal application ports or expand the public API solely for harness convenience.

## Completion evidence for an architecture change

A structural change is complete when the resolved source graph has no cycles or
forbidden edges; ports describe siro operations without concrete engine switches;
core behavior can run with supplied test ports; and adapter, CLI and installed
package checks preserve the observable contract. Keep the public design guide,
private maintainer material and private package consumers aligned with that state.
Do not substitute a green graph check for behavioral and integration evidence.
