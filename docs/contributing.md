# Contributing

Use the Node range in `package.json` and the pinned pnpm version. After cloning,
run `pnpm install --frozen-lockfile` and `git config core.hooksPath .githooks`.
Pre-commit typechecks and checks the working tree; pre-push and CI run `verify`.
Partially staged changes are not validated as a separate tree.

| Command         | Purpose                                                            |
| --------------- | ------------------------------------------------------------------ |
| `pnpm verify`   | Typecheck, lint, format, unused code, generated docs, build, tests |
| `pnpm test`     | Build and run tests, including the executable CLI and library      |
| `pnpm build`    | Bundle the CLI and library with declarations                       |
| `pnpm gen:docs` | Regenerate the rule reference and comparison matrix                |
| `pnpm gen:api`  | Generate the ignored API reference in `docs/api/`                  |
| `pnpm bench`    | Measure evaluation with in-memory repositories                     |

Reproduce a defect with a failing behavior test, fix it, then simplify. Test
relevant defaults, precedence, malformed inputs, and failure paths. Keep tests
that describe observable behavior; counts and repeated clean reviews do not
establish correctness.

## Runtime responsibilities

The CLI parses arguments and imports the repository's executable configuration.
The library accepts explicit configuration and reads package-manager settings
through `FileSystem`. It validates configuration, selects rules and package
managers, evaluates checks, and returns `LintResult`. `lintCommand` adds reporter
selection, severity filtering, and an exit code.

A binding's `check` returns `ok`, `na`, or a violation with its remediation.
Automatic remediation contains non-empty key operations; manual remediation
contains non-empty instructions. They cannot coexist. A missing binding means
that a rule does not apply to that package manager. A binding without `file`
uses the repository context directly, such as a lockfile existence check.

The evaluation cache belongs to one repository and one run. User severity
settings override result, binding, and rule defaults, in that order. Preserve
these boundaries because they prevent inconsistent results, not to satisfy a
prescribed number of layers or files.

## Adding a rule

1. Identify the policy and its limits from official documentation or source.
   Keep version notes on the binding and cite their basis in [policy sources](policy-sources.md).
2. Add a rule in `src/domain/rules/` and register it in `src/domain/builtin-rules.ts`.
   Use `requireConfigKey` for a single setting; use a direct binding for precedence,
   multiple settings, or manual remediation. See [configuration.md](configuration.md).
3. Test the unsafe state, accepted states, relevant bypasses, and the proposed
   remedy. Exercise the CLI when the change affects parsing, selection, or output.
4. Run `pnpm gen:docs` and `pnpm verify`.

Adding a package manager also requires detection signals and applicable bindings.
Add a codec only when its format differs from the supported formats.

## Verification boundaries

Use in-memory files for deterministic evaluation tests, temporary directories for
Node imports and filesystem behavior, and the built executable for exit codes
and packaging behavior. Exercise the packed package from a separate consumer
before a release; repository imports can hide missing dependencies or exports.

`pnpm bench` excludes process startup and disk I/O. Compare unchanged source
snapshots with identical Node and dependencies, alternating repeated runs. Measure
the built CLI separately before claiming a startup improvement.

Package contents should contain only distributed code and public package documents.
