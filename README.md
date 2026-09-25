# siro

[![CI](https://img.shields.io/github/actions/workflow/status/pHo9UBenaA/siro/ci.yaml?branch=main)](https://github.com/pHo9UBenaA/siro/actions)
[![npm](https://img.shields.io/npm/v/@pho9ubenaa/siro)](https://www.npmjs.com/package/@pho9ubenaa/siro)
[![license](https://img.shields.io/github/license/pHo9UBenaA/siro)](https://github.com/pHo9UBenaA/siro/blob/main/LICENSE)

A security-configuration linter for npm, pnpm, Yarn, Bun, Deno, and [Aube](https://github.com/aubepkg/aube).
It reports supported dependency-installation and publication policy gaps, such as permissive
lifecycle scripts, unpinned versions, and missing publication safeguards. It does not install
packages or change your files.

| Tool                                                                          | Focus                                         | Input                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| siro                                                                          | Supported package-manager configuration risks | Repository manifests and config files     |
| `npm audit`, [OSV-Scanner](https://github.com/google/osv-scanner), Dependabot | Known dependency vulnerabilities              | Dependencies and vulnerability advisories |

Use both kinds of checks: neither a clean lint result nor a clean vulnerability scan proves the project is safe.

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
suggests fixes but **does not edit files**: review changes and rerun the linter. Use JSON for
machine-readable remediation or GitHub Actions annotations in CI:

```sh
npx @pho9ubenaa/siro lint --reporter json
npx @pho9ubenaa/siro lint --reporter github
npx @pho9ubenaa/siro lint --severity warn  # also fail on warnings
```

For regular use, install it as a dev dependency with
`npm install --save-dev --save-exact @pho9ubenaa/siro` and run `siro lint` in your CI script.
`--workspaces` also checks declared members' publication metadata; installation policy remains
root-only. See [getting started](docs/getting-started.md) for other CLI options and
[configuration](docs/configuration.md#exit-codes) for exit-code details.

See the [rule reference](docs/rules.md) and [PM comparison](docs/comparison.md) for coverage, [configuration and workspace behavior](docs/configuration.md) for scope and limits, and [JSON output](docs/json-output.md) for the remediation contract.

Contributing? See the [contributor guide](docs/contributing.md). Report vulnerabilities through [SECURITY.md](SECURITY.md).

## License

MIT
