# Contributing

Use the Node range in `package.json` and its pinned pnpm version. After cloning:

```sh
pnpm install --frozen-lockfile
git config core.hooksPath .githooks
pnpm verify
```

Pre-commit checks types and formatting/lint; pre-push and CI run `verify`.
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

After `pnpm verify`, run `pnpm test:package`. It installs the packed artifact in a
temporary project with install scripts disabled, then checks public files, API,
TypeScript declarations and CLI exit behavior. Missing dependencies may be downloaded.
CI runs it on both supported Node majors and on Linux and Windows.

To verify an existing artifact, run `pnpm test:package /absolute/path/package.tgz`.
To retain a verified artifact, use
`pnpm test:package --output /absolute/path/package.tgz`. Verification never publishes;
the publication workflow stages the verified tarball without repacking it.
