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
| `application/**/ports/`      | Host-neutral contracts for application operations                                             | Application ports, domain, shared                                     |
| `application/` (other files) | Input validation, PM/workspace selection, evaluation and reporting use cases                  | Application, application ports, domain, shared                        |
| `adapters/`                  | Node filesystem/paths, configuration import, codecs, glob engine and output formats           | Adapters, application ports, domain, shared                           |
| `composition/`               | Connect standard adapters and time-dependent rules                                            | Composition, adapters, application, application ports, domain, shared |
| `cli/`, `cli.ts`, `index.ts` | CLI driving adapter and public package facade                                                 | Inward dependencies; never imported by the core                       |

Driven adapters must not import application implementations. The config loader
imports domain configuration validation, shared with the library use case. The
path adapter imports only its small `RepositoryPaths` contract, not the aggregate
lint dependency contract.

The architecture gate checks **source dependency direction between areas**,
including type imports and re-exports. It does not require one file per concept,
a particular file size, or an acyclic graph within a layer. A cycle is not proof
of a good design either: review runtime cycles and the responsibilities they join
when they occur. `ConfigFileRef` currently lives in an independent domain value
module; built-in rule ID completion follows the registry as a type dependency.
Those arrangements are implementation choices, not templates for future modules.

`version.ts` exposes static package metadata. It is not a runtime dependency
provider. The architecture test resolves TypeScript modules, including `.js`
references to `.ts` sources, before checking direction. It rejects unresolved
local references, checks imports/re-exports (including types and static dynamic
imports), rejects Node built-in imports in the core, and rejects dynamic module
selection there because its target cannot be checked statically. It does not
whitelist external computation libraries or police expressions such as `Date`:
typecheck, build, installed-package tests and behavioral review own those risks.
The test does not inspect third-party internals or sandbox user code. Executable
user configuration is intentionally loaded dynamically by the outer config adapter.

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
   exit status from all findings, filters display results in `application/commands/filter.ts`,
   and awaits output through `Reporter` and `IO`.
   Reporter rejection propagates; the CLI classifies errors and owns process exit.

`FileSystem` distinguishes absence from failure: only ENOENT is absent; other
errors and non-file entries propagate. Each repository context reads its
`package.json` once; its parsed manifest and rule config are derived from the
same source text. This is not a snapshot of the entire filesystem, and a new
`lint` call creates new contexts. Workspace discovery requires directory
operations on the supplied filesystem and never falls back to the host filesystem.
`RepositoryPaths` separates native absolute paths from POSIX workspace patterns.
`WorkspaceGlobs` supplies bounded expansion, membership and traversal predicates;
the application owns PM syntax policy, inclusion order and member scope.
The glob port distinguishes declaration comparison from directory matching and
expresses case, punctuation, hidden-directory and extended-pattern behavior.
Minimatch options, optimization and literal-bracket escaping stay in its adapter.
The explicit case policy preserves the host's existing glob behavior. Native
literal-directory resolution is a separate filesystem operation.
`application/workspace-definitions.ts` reads and validates declarations from PM-specific
sources; its `fromDenoJson` flag identifies native Deno workspace declarations,
whose members may use `deno.json` without `package.json`.
`application/workspace-selection.ts` compiles PM-specific inclusion, exclusion,
and descent decisions without compiling standard globs for Bun's separate ordered pass; `application/workspaces.ts` traverses directories only
through the supplied filesystem. These are internal boundaries, not public APIs.

The domain owns release-age policy. `DateTime.now()` supplies current epoch
milliseconds at evaluation time. `DateTime.parse()` supplies native parsing, including the host timezone for
offsetless npm cutoffs; explicit UTC arithmetic stays in the domain. This preserves
the existing JavaScript semantics. Tests can supply a fixed clock without patching globals.
No new clock or glob injection surface is added to the public API.

PM-specific policy is part of siro's purpose: adding a PM binding does not imply
moving that policy to an adapter. Similarly, workspace root installation policy
and child publication policy remain separate. `application/lint.ts` explicitly
selects the built-in publication rule IDs evaluated for members; when adding a
built-in rule, decide and test its root/member scope there. Custom rules remain
root-only. Remediation is a proposal; this architecture does not add file-writing
capabilities.

## Changing and verifying boundaries

Put a port with the core responsibility that needs it. Keep contracts small and
state absence, failures and ownership. Use functions and explicit dependencies;
a DI container or a class per use case is unnecessary. Standard wiring belongs
in composition, never in core defaults or a shared module that imports adapters.

- Core tests supply ports and verify decisions, precedence, failures and isolation.
- Adapter tests exercise parsing, filesystem semantics and output contracts.
- Composition/API/CLI tests exercise real wiring, trust boundaries and exit codes.
- `pnpm verify` includes the direction gate and behavioral tests. Gate
  examples cover type imports, module resolution, ports under feature folders,
  and adapter-to-use-case violations. The gate is not a module-design verdict.
- `pnpm test:package` checks installed exports, types and the executable. Source
  imports alone do not establish package compatibility.

Keep the public exports, synchronous `lint`, asynchronous `lintCommand`, JSON
schema, error categories and PM semantics stable during structural refactors.
Private consumers must use the built package entry point; they must not import
internal application ports or expand the public API solely for harness convenience.

## Completion evidence for an architecture change

A structural change is complete when the resolved source graph has no forbidden
cross-area edges; any cycles and port boundaries have been assessed for actual
responsibility and runtime risks; core behavior can run with supplied test ports;
and adapter, CLI and installed-package checks preserve the observable contract.
Keep the public design guide, private maintainer material and private package
consumers aligned with that state. Do not substitute a green direction check for
behavioral and integration evidence.
