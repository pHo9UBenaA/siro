# Contributing

Use the Node range in `package.json` and its pinned pnpm version. After cloning:

```sh
pnpm install --frozen-lockfile
git config core.hooksPath .githooks
pnpm verify
```

Pre-commit checks types, formatting/lint and tests; pre-push and CI run `verify`.
Hooks check the working tree, not a separate partially staged tree.

| Command             | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm verify`       | Types, lint/format, unused code, generated docs, build and tests |
| `pnpm test`         | Build and run tests, including CLI and library behavior          |
| `pnpm build`        | Bundle the CLI and library with declarations                     |
| `pnpm gen:docs`     | Regenerate the rule reference and comparison matrix              |
| `pnpm gen:api`      | Generate the local API reference in ignored `docs/api/`          |
| `pnpm test:package` | Verify the built package from an isolated consumer               |
| `pnpm bench`        | Benchmark evaluation, excluding process startup and disk I/O     |

## Formatting and linting

Run `pnpm format` for layout and `pnpm lint:fix` for safe automatic lint fixes;
review the diff, then run `pnpm verify`. Some lint findings require a manual fix.
`pnpm check` checks without rewriting files and rejects unused lint suppressions.

Oxfmt owns whitespace, quotes and wrapping. Oxlint checks correctness, unnecessary
branches, nested ternaries and avoidable reassignment. Simple ternaries, nullish
`== null` checks and intentional `let` reassignment remain valid. Names, useful
comments and responsibility boundaries still need human review; do not split
functions or introduce abstractions just to shorten them.

## Source map

- `src/core/`: linting decisions and rules, independent of Node IO.
- `src/adapters/`: filesystem access, parsers and reporters.
- `src/runtime.ts`: connects the core to its adapters.
- `src/cli.ts` and `src/index.ts`: CLI and public library entry points.
- `test/`: behavior tests; `test/architecture.test.ts` checks dependency direction.

Adapters depend on core contracts, not use-case implementations. Follow the
relevant source and tests for implementation details.

## Making changes

For a bug fix, add a test that reproduces the incorrect behavior. Test affected
defaults, precedence and failure cases. Use the real CLI or installed package
when changing process behavior, exports or packaging.

To add or change a rule:

1. Establish the policy from official documentation or source. Record important
   version limits and precedence in [policy sources](policy-sources.md).
2. Update `src/core/rules/` and register new rules and their inspection scope in
   `src/core/rules/builtin-rules.ts`. For manifest rules, also update
   `src/core/manifest-checks.ts`. Use an existing rule with similar inputs as a guide.
3. Add behavior tests, then run `pnpm gen:docs` and `pnpm verify`.

Keep the [configuration reference](configuration.md), [JSON contract](json-output.md)
and changelog current when public behavior changes. `docs/rules.md` and
`docs/comparison.md` are generated; edit their sources rather than the output.

## Package verification

After `pnpm verify`, run `pnpm test:package` to check the distributed files, installed
API, TypeScript declarations and CLI exits. It may download dependencies, with install
scripts disabled. CI runs it on both supported Node majors and on Linux and Windows.

To verify an existing artifact, run `pnpm test:package /absolute/path/package.tgz`.
To retain a verified artifact, use
`pnpm test:package --output /absolute/path/package.tgz`. Verification never publishes;
the publication workflow stages the verified tarball without repacking it.

## Release controls

Prepare releases on `release/v<x.y.z>` with Conventional Commits. Merge reviewed
changes into protected main before tagging `v<x.y.z>`; the tag must match the
package version. The [publish workflow](../.github/workflows/publish.yaml) verifies
and stages the package. Staging is separate from approval and public availability.

Before publishing, protect main and `v*` tags, configure the `npm-publish` environment
with required reviewers and tag restrictions, and match the npm trusted publisher
binding to this repository, `publish.yaml` and environment.
