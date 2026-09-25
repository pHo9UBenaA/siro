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

siro detects managers from `packageManager`, lockfiles, and configuration files. If it cannot
detect one, choose it explicitly, for example `npx @pho9ubenaa/siro lint --pm npm`.
The CLI may download code through `npx` and imports a repository's `siro.config.*` as executable
code. Review configurations before running it on an unfamiliar project; see the
[threat model](docs/threat-model.md).

## Read findings and add CI

Findings have `error`, `warn`, or `info` severity. Exit `0` means no findings at or above the
selected threshold; exit `1` means there are findings. Usage/configuration errors exit `2`
without completing the check; unexpected failures exit `70`. Errors fail CI by default. siro
suggests fixes but **does not edit files**: review changes and rerun the linter.

For regular use, install it as a dev dependency with
`npm install --save-dev --save-exact @pho9ubenaa/siro` and run `siro lint` in your CI script.

## Common CLI options

`check` is an alias for `lint`. Run `siro lint --help` for the complete CLI syntax.

| Option                                    | Use                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `--pm <npm\|pnpm\|yarn\|bun\|deno\|aube>` | Inspect one manager instead of auto-detection.                                             |
| `--pm-version <x.y.z>`                    | Supply an exact stable target version (requires `--pm`); it does not run an installed PM.  |
| `--project-type <application\|package>`   | Choose whether publication safeguards apply; omitted means infer from publish metadata.    |
| `--workspaces`                            | Also check declared members' publication metadata; installation checks remain at the root. |
| `--severity <error\|warn\|info>`          | Set both the display and CI failure threshold; default failure threshold is `error`.       |
| `--reporter <pretty\|json\|github>`       | Choose terminal, JSON, or GitHub Actions output; `--json` is a JSON shortcut.              |

For a walkthrough and deeper reference, use these guides:

- [Getting started](docs/getting-started.md) walks through findings and CI; [configuration](docs/configuration.md) covers PM selection, workspace scope, executable config, and exit codes.
- The [rule reference](docs/rules.md) and [PM comparison](docs/comparison.md) show what is checked for each manager.
- [JSON output](docs/json-output.md) documents the machine-readable remediation contract.

## License

MIT
