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
The CLI automatically reads `siro.config.json` as data. `npx` may download code.
Executable repository configuration requires an explicit `--config <path>` and runs
with your permissions. For unfamiliar projects, `--no-config --strict-filesystem`
narrows the inputs; neither flag is a sandbox. See the [threat model](docs/threat-model.md).

## Read findings and add CI

Findings have `error`, `warn`, or `info` severity. Exit `0` means no findings at or above the
selected threshold; exit `1` means there are findings. Errors fail CI by default; see
[exit codes](docs/configuration.md#severity-reporters-cli-and-exits) for `2` and `70`.
siro suggests fixes but **does not edit files**: review changes and rerun the linter.

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
| `--config <path>`                         | Select JSON settings or explicitly execute trusted JS/TS configuration.                   |
| `--exclude <pattern>`                     | Prune directories from recursive discovery (repeatable).                                  |
| `--installation-root <path>`              | Replace the default cwd installation scope (repeatable; include `.` to retain cwd).       |
| `--severity <error\|warn\|info>`          | Set both the display and CI failure threshold; default failure threshold is `error`.      |
| `--reporter <pretty\|json\|github>`       | Choose terminal, JSON, or GitHub Actions output; `--json` is a JSON shortcut.             |

`--no-config` skips repository configuration; `--strict-filesystem` rejects
symlink input paths in native data reads. Scans also have finite caller-controlled
[file, tree, nesting, finding and output budgets](docs/configuration.md#strict-filesystem-and-scan-budgets).
Overflow fails the check rather than silently skipping inputs.

Documentation by task:

| If you want to…                                           | Read                                         |
| --------------------------------------------------------- | -------------------------------------------- |
| Run a first scan, then add it to CI                       | [Getting started](docs/getting-started.md)   |
| Set options, inspection scope, config or migrate          | [Configuration](docs/configuration.md)       |
| Check what a rule does, on which inputs, at what severity | [Rule reference](docs/rules.md)              |
| See which package managers a rule covers                  | [PM comparison](docs/comparison.md)          |
| Consume or emit the machine-readable report               | [JSON output](docs/json-output.md)           |
| Judge why a finding is justified                          | [Policy and sources](docs/policy-sources.md) |
| Know what a clean result does and does not prove          | [Threat model](docs/threat-model.md)         |
| Build, verify or release siro                             | [Contributing](docs/contributing.md)         |

## License

MIT
