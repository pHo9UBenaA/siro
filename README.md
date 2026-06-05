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
npx @pho9ubenaa/siro lint --reporter json # machine-readable output with fix ops (see docs/json-output.md)
```

## Features

- **27 rules across 6 managers.** Covering lifecycle scripts, version pinning, lockfiles
  (`commit`/`frozen`), release age, publish provenance, `files`/`publishConfig`, SSL enforcement,
  checksum verification, exotic subdependency blocking, audit suppression review, store integrity,
  Bun's security scanner API, and Yarn 4's hardened-mode — each mapped to the right setting per
  package manager (`.npmrc`, `pnpm-workspace.yaml`, `.yarnrc.yml`, `bunfig.toml`, `deno.json`,
  `aube-workspace.yaml`, `package.json`).
- **PM-aware severities.** When a manager's documented default already satisfies a rule (e.g.
  Yarn's `enableScripts: false`, aube's `preferFrozenLockfile: true`), the finding is demoted
  to `info` so CI noise stays proportional to real risk.
- **Machine-readable remediation.** Every finding carries `fix` operations and `manualSteps` in the
  JSON output — hand it to an agent skill or editor plugin that edits the files and re-runs
  `siro lint` until it exits `0`. See [JSON output](docs/json-output.md).
- **Lint with severities.** `error` fails CI by default; `--severity warn` tightens the gate.
- **Reporters.** `pretty` (default), `json` for CI, `github` for PR annotations; register your own.
- **Configurable.** Drop a `siro.config.ts` to disable rules, override severities, restrict PMs,
  or plug in custom rules and reporters.

See the [rule reference](docs/rules.md) for what each check does and why, and the
[comparison matrix](docs/comparison.md) for per-manager support at a glance.

## Versioning policy

`siro` is **version-agnostic**: it never inspects the actual version of npm / pnpm / yarn / bun /
deno your project is running. Every rule is written against the **latest stable major** of each
manager — that's the configuration surface we lint and the defaults we trust.

When a rule's binding knows that a key was introduced or had its default tightened in a specific
version, the finding's message carries a `(available since pnpm 10.16.0; default safe since pnpm 11.0.0 (1440 minutes))`
suffix as documentation — but siro does not branch on it. If your project pins an older PM, the
right move is usually to upgrade; the lint output stays the same either way.

See [version matrix](docs/version-matrix.md) for the per-rule × per-PM version table
that backs those suffixes.

## Usage

```
siro <lint|check> [path] [options]

 --pm <npm|pnpm|yarn|bun|deno|aube> Target a specific package manager (auto-detected; required if detection finds nothing)
 --reporter <pretty|json|github> Output format (default pretty)
 --severity <error|warn|info> Show and fail on findings at or above this level
 --json Shortcut for --reporter json
 --version, --help
```

`check` is an alias of `lint` (same flags, same exit codes) — provided so `siro check` reads naturally in CI scripts.

Exit codes: `0` clean · `1` findings at/above threshold · `2` usage error.

## How is this different from `npm audit` / `osv-scanner`?

Different layer of the supply-chain pipeline; you want both.

| Tool                                          | What it checks                                                                                                                               | Where the data comes from                                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm audit` · osv-scanner · Snyk · Dependabot | **Known CVEs** in your installed dependency tree                                                                                             | GHSA / OSV.dev / vendor feeds                                                                                                        |
| `siro`                                        | **Your install pipeline's configuration** — postinstall scripts, version ranges, lockfile policy, publish provenance, files allow-list, etc. | Static analysis of `.npmrc`, `pnpm-workspace.yaml`, `.yarnrc.yml`, `bunfig.toml`, `deno.json`, `aube-workspace.yaml`, `package.json` |

`npm audit` tells you "this dependency has a known vulnerability". `siro` tells you "even if a brand-new vulnerability lands tomorrow, your install settings can't trust it without review". Run both in CI.

## Contributing

Adding a rule or a package manager is a localized change — see
[contributing guide](docs/contributing.md).

## License

MIT
