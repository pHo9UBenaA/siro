# siro

[![CI](https://img.shields.io/github/actions/workflow/status/pHo9UBenaA/siro/ci.yaml?branch=main)](https://github.com/pHo9UBenaA/siro/actions)
[![npm](https://img.shields.io/npm/v/@pho9ubenaa/siro)](https://www.npmjs.com/package/@pho9ubenaa/siro)
[![license](https://img.shields.io/github/license/pHo9UBenaA/siro)](https://github.com/pHo9UBenaA/siro/blob/main/LICENSE)

A security-configuration linter for npm, pnpm, Yarn, Bun, Deno, and Aube.
It reports supported dependency-installation and publication policy gaps, such as permissive
lifecycle scripts, unpinned versions, and missing publication safeguards. It does not install
packages or change your files.

| Approach                      | Primary question                              | Typical input                                |
| ----------------------------- | --------------------------------------------- | -------------------------------------------- |
| siro: configuration lint      | Are supported install/publish settings risky? | Repository manifests and configuration files |
| Dependency vulnerability scan | Do dependencies match known advisories?       | Dependency inventory and vulnerability data  |
| Dependency update automation  | Which dependencies can be updated?            | Manifests, lockfiles, and package registries |

These approaches complement one another; a clean result does not guarantee safety.

## Try it

Requires Node.js `^22.18.0` or `^24.0.0`. From your repository:

```sh
npx @pho9ubenaa/siro lint
```

siro recursively discovers package.json and strict deno.json below cwd, independently of PM
workspace declarations. It checks local installation policy at cwd by default; add independent
projects with `--installation-root`. Exclude intentional fixtures with `--exclude test/fixtures`.
Discovery does not imply that every package's installation settings were inspected.

siro detects managers from `packageManager`, lockfiles, and configuration files. If it cannot
detect one, choose it explicitly, for example `npx @pho9ubenaa/siro lint --pm npm`.
The CLI may download code through `npx` and imports a repository's `siro.config.*` as executable
code by default. For an unfamiliar project, use `siro lint --no-config --strict-filesystem`
in an isolated environment without credentials. These flags do not sandbox npx or
extensions; see the [threat model](docs/threat-model.md).

## Read findings and add CI

Findings have `error`, `warn`, or `info` severity. Exit `0` means no findings at or above the
selected threshold; exit `1` means there are findings. Usage/configuration errors exit `2`
without completing the check; unexpected failures exit `70`. Errors fail CI by default. siro
suggests fixes but **does not edit files**: review changes and rerun the linter.

For regular use, install it with `npm install --save-dev --save-exact @pho9ubenaa/siro`
and add a package script:

```json
{
  "scripts": { "lint:security": "siro lint" }
}
```

After installing dependencies in CI, run `npm run lint:security`. A local install
makes `siro` available to package scripts, not to every shell or Git hook.
For exclusions and rule overrides, see the [configuration examples](docs/configuration.md).

## Common CLI options

`check` is an alias for `lint`. Run `npx @pho9ubenaa/siro lint --help` for the complete CLI syntax.

| Option                                    | Use                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--pm <npm\|pnpm\|yarn\|bun\|deno\|aube>` | Select one manager at cwd; additional installation roots retain their own targets.        |
| `--pm-version <x.y.z>`                    | Supply an exact stable target version (requires `--pm`); it does not run an installed PM. |
| `--project-type <application\|package>`   | Choose whether publication safeguards apply; omitted means infer from publish metadata.   |
| `--exclude <pattern>`                     | Prune directories from recursive discovery (repeatable).                                  |
| `--installation-root <path>`              | Replace the default cwd installation scope (repeatable; include `.` to retain cwd).       |
| `--severity <error\|warn\|info>`          | Set both the display and CI failure threshold; default failure threshold is `error`.      |
| `--reporter <pretty\|json\|github>`       | Choose terminal, JSON, or GitHub Actions output; `--json` is a JSON shortcut.             |

`--no-config` disables executable configuration; `--strict-filesystem` rejects
symlink input paths in native data reads. Scans also have finite caller-controlled
[file, tree, nesting, finding and output budgets](docs/configuration.md#strict-filesystem-and-scan-budgets).
Overflow fails the check rather than silently skipping inputs.

For a walkthrough and deeper reference, use these guides:

- [Getting started](docs/getting-started.md) walks through findings and CI; [configuration](docs/configuration.md) covers local PM/version selection, discovery and explicit installation scope, executable config, exit codes, and migration from the removed `--workspaces` flag.
- The [rule reference](docs/rules.md) and [PM comparison](docs/comparison.md) show what is checked for each manager.
- [JSON output](docs/json-output.md) documents the machine-readable remediation contract.
- [Contributing](docs/contributing.md) covers development setup, the source map, and verification.

## License

MIT
