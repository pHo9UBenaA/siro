# Architecture

siro uses ports and adapters. Its application evaluates repository policy without
selecting a filesystem, parser, reporter, clock, or host platform. The public Node
API supplies the standard implementations, so callers still use `lint(options)`
and `lintCommand(options, io)` without assembling internal dependencies.

## Dependency direction

| Area                         | Responsibility                                                                                  | Allowed internal dependencies                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `shared/`                    | Errors, records, branded path types and relative-path validation                                | Shared only                                        |
| `domain/`                    | Rules, PM bindings, severity, version availability and domain ports                             | Domain, shared                                     |
| `application/`               | Input validation, PM/workspace selection, evaluation and reporting use cases; application ports | Application, domain, shared                        |
| `adapters/`                  | Node filesystem/paths, configuration import, codecs, glob engine and output formats             | Adapters, application, domain, shared              |
| `composition/`               | Connect standard adapters and time-dependent rules                                              | Composition, adapters, application, domain, shared |
| `cli/`, `cli.ts`, `index.ts` | CLI driving adapter and public package facade                                                   | Inward dependencies; never imported by the core    |

`version.ts` exposes static package metadata. It is not a runtime dependency
provider. The core permits `semver` and `valibot` for computation and validation;
format, filesystem and glob libraries remain in adapters. Architecture tests
check every source file, imports/re-exports (including type imports), known host
globals, and dynamic module selection in the core. They enforce source boundaries,
not a security sandbox for custom rules or dependencies.

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
the application owns PM dialect options, inclusion order and member scope.
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
- `pnpm verify` includes architecture checks and behavioral tests.
- `pnpm test:package` checks installed exports, types and the executable. Source
  imports alone do not establish package compatibility.

Keep the public exports, synchronous `lint`, asynchronous `lintCommand`, JSON
schema, error categories and PM semantics stable during structural refactors.
Private consumers must use the built package entry point; they must not import
internal application ports or expand the public API solely for harness convenience.
