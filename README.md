# siro

[![CI](https://img.shields.io/github/actions/workflow/status/pHo9UBenaA/siro/ci.yaml?branch=main)](https://github.com/pHo9UBenaA/siro/actions)
[![npm](https://img.shields.io/npm/v/@pho9ubenaa/siro)](https://www.npmjs.com/package/@pho9ubenaa/siro)
[![license](https://img.shields.io/github/license/pHo9UBenaA/siro)](https://github.com/pHo9UBenaA/siro/blob/main/LICENSE)

A security best-practices linter for npm, pnpm, Yarn, Bun, Deno, and [Aube](https://github.com/aubepkg/aube). It checks supported repository configuration for dependency-installation and publication risks. It does **not** detect vulnerable packages or prove an installation is safe; use a vulnerability scanner alongside it. The checks are inspired by [npm security best practices](https://github.com/bodadotsh/npm-security-best-practices), but siro is not affiliated with that guide.

## Try it

```sh
npx @pho9ubenaa/siro lint
```

The CLI may download code through `npx` and imports a repository's `siro.config.*` as executable code. Review configurations before running it on an unfamiliar project. See the [threat model](docs/threat-model.md).

Findings have `error`, `warn`, or `info` severity. Errors fail CI by default. siro proposes fixes but **does not edit files**. For machine-readable findings:

```sh
npx @pho9ubenaa/siro lint --reporter json
```

[Getting started](docs/getting-started.md) covers installation, CI, and CLI options. See the [rule reference](docs/rules.md) and [PM comparison](docs/comparison.md) for coverage, [configuration and workspace behavior](docs/configuration.md) for scope and limits, and [JSON output](docs/json-output.md) for the remediation contract.

Contributing? See the [contributor guide](docs/contributing.md). Report vulnerabilities through [SECURITY.md](SECURITY.md).

## License

MIT
