# siro

[![CI](https://img.shields.io/github/actions/workflow/status/pHo9UBenaA/siro/ci.yaml?branch=main)](https://github.com/pHo9UBenaA/siro/actions)
[![npm](https://img.shields.io/npm/v/@pho9ubenaa/siro)](https://www.npmjs.com/package/@pho9ubenaa/siro)
[![license](https://img.shields.io/github/license/pHo9UBenaA/siro)](https://github.com/pHo9UBenaA/siro/blob/main/LICENSE)

> Security best-practices linter for the npm ecosystem — npm, pnpm, yarn, bun, deno, aube.

[Getting started](docs/getting-started.md) ·
[Rules](docs/rules.md) ·
[Comparison](docs/comparison.md) ·
[Configuration](docs/configuration.md)

`siro` **lints** repos for supply-chain risks, graded `error` / `warn` / `info`,
and emits machine-readable remediation so an editor or agent skill
can apply the fixes.

```sh
npx @pho9ubenaa/siro lint
npx @pho9ubenaa/siro lint --reporter json # machine-readable remediation (see docs/json-output.md)
```

## A concrete example

For maintainers and CI owners, siro makes package-manager policy gaps visible during review. For example, change an unsafe npm script setting:

```diff
# .npmrc
-ignore-scripts=false
+ignore-scripts=true
```

Run `siro lint --pm npm --project-type application` before and after the edit. The `disable-lifecycle-scripts` error clears when this setting is enabled; other findings remain until addressed. Review required build scripts before changing their execution policy.

The CLI reads `siro.config.*` as executable code. Review repository configuration before running it, particularly in CI. See the [threat model](docs/threat-model.md) and [security reporting policy](SECURITY.md).

## Features

- **27 rules across 6 managers.** Covering lifecycle scripts, version pinning, lockfiles
  (`commit`/`frozen`), release age, publish provenance, `files`/`publishConfig`, SSL enforcement,
  checksum verification, exotic subdependency blocking, audit suppression review, store integrity,
  Bun's security scanner API, and Yarn 4's hardened-mode — each mapped to the right setting per
  package manager (`.npmrc`, `pnpm-workspace.yaml`, `.yarnrc.yml`, `bunfig.toml`, `deno.json`,
  `aube-workspace.yaml`, `package.json`).
- **PM-aware severities.** When a manager's documented default already satisfies a rule (e.g.
  Yarn's `enableScripts: false`, pnpm's `strictDepBuilds: true`), the finding is demoted
  to `info` so CI noise stays proportional to real risk.
- **Machine-readable remediation.** A finding can carry automatic key operations or manual
  instructions. Review proposed changes and rerun the linter after editing.
  See [docs/json-output.md](docs/json-output.md).
- **Lint with severities.** `error` fails CI by default; `--severity warn` tightens the gate.
- **Reporters.** `pretty` (default), `json` for CI, `github` for PR annotations; register your own.
- **Configurable.** Drop a `siro.config.ts` to disable rules, override severities, restrict PMs,
  or plug in custom rules and reporters.

See the [rule reference](docs/rules.md) for what each check does and why, and the
[comparison matrix](docs/comparison.md) for per-manager support at a glance.

## Versioning policy

siro evaluates the recorded policy snapshot in [docs/version-matrix.md](docs/version-matrix.md).
It detects package-manager names, not effective runtime versions. Version annotations describe
verified upstream facts; they do not change rule behavior. See [configuration](docs/configuration.md)
for defaults, applicability, and limits.

## Usage

```
siro <lint|check> [path] [options]

 --pm <npm|pnpm|yarn|bun|deno|aube> Target a specific package manager (auto-detected; required if detection finds nothing)
 --project-type <application|package> Select application or published-package policy (default auto)
 --reporter <pretty|json|github> Output format (default pretty)
 --severity <error|warn|info> Show and fail on findings at or above this level
 --json Shortcut for --reporter json
 --version, --help
```

`check` is an alias of `lint` (same flags, same exit codes) — provided so `siro check` reads naturally in CI scripts.

Exit codes: `0` clean · `1` findings at/above threshold · `2` usage error · `70` uncaught exception (a siro bug or a throwing reporter/custom rule).

## How is this different from `npm audit` / `osv-scanner`?

Different layer of the supply-chain pipeline; you want both.

| Tool                                          | What it checks                                                                                                                               | Where the data comes from                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm audit` · osv-scanner · Snyk · Dependabot | **Known CVEs** in your installed dependency tree                                                                                             | GHSA / OSV.dev / vendor feeds                                                                                                        |
| `siro`                                        | **Your install pipeline's configuration** — postinstall scripts, version ranges, lockfile policy, publish provenance, files allow-list, etc. | Static analysis of `.npmrc`, `pnpm-workspace.yaml`, `.yarnrc.yml`, `bunfig.toml`, `deno.json`, `aube-workspace.yaml`, `package.json` |

`npm audit` reports known vulnerabilities. `siro` reports supported configuration gaps that can increase exposure to malicious dependencies. Neither a clean result nor a cooldown window guarantees safety. Run both in CI.

## Contributing

Adding a rule or a package manager is a localized change — see
[contributing guide](docs/contributing.md).

## License

MIT
