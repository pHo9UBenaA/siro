# Getting started

## Run without adding a dependency

```sh
npx @pho9ubenaa/siro lint
```

`npx` may download and execute the tool. The CLI also imports any repository
`siro.config.*` as executable code; review untrusted configurations first.
See the [threat model](threat-model.md).

`siro` detects package managers from the `packageManager` field, lockfiles, and config
files, then reports supported configuration gaps. It does not scan for known vulnerabilities.
If detection finds no manager, pass `--pm` explicitly.

## Choose the scope

The default is recursive package.json / strict deno.json discovery, but local
installation checks run only at cwd. PM workspace exclusions no longer select
packages. Exclude deliberate fixtures; explicitly add independent install projects:

```sh
npx @pho9ubenaa/siro lint . --exclude test/fixtures --exclude vendor --exclude dist
npx @pho9ubenaa/siro lint . --installation-root . --installation-root tools/standalone
```

Replace `tools/standalone` with an existing independent installation directory.
The repeatable flags replace config arrays. Additional roots use their own PM and
version, not root `--pm` options. Use config `{ installationRoots: [] }` for a
manifest-only scan, or object entries to specify a PM per additional root. The
[config examples](configuration.md#rule-settings) include rule overrides and an
import-free `siro.config.mjs` usable with `npx`. Review
`inspection` in JSON: discovering packages is not a guarantee that every independent
project's install policy was checked.

## Fix the findings

siro is a linter: it reports violations but never writes your config files.
Built-in findings include machine-readable remediation (`remediation`) in the JSON output. Custom rules may omit it:

```sh
npx @pho9ubenaa/siro lint --reporter json
```

Review and apply the proposed operations or manual steps with your editor — or hand the JSON to an agent
skill that edits the files and re-runs `npx @pho9ubenaa/siro lint` until it exits `0`. For example,
if an npm repo sets `ignore-scripts=false` in `.npmrc`, consider whether its builds
require lifecycle scripts before setting it to `true`. Other findings may remain.
The output shape is a versioned contract; see [json-output.md](json-output.md).

## Add it to CI

```sh
npx @pho9ubenaa/siro lint                            # fails (exit 1) on any error-level finding
npx @pho9ubenaa/siro lint --severity warn            # also fail on warnings
npx @pho9ubenaa/siro lint --reporter json            # machine-readable output (equivalent to --json)
npx @pho9ubenaa/siro lint --reporter github          # GitHub Actions annotations on PRs
```

## Common options

`check` is an alias for `lint`. Run `npx @pho9ubenaa/siro lint --help` for the complete CLI syntax.

| Option                                    | Use                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--pm <npm\|pnpm\|yarn\|bun\|deno\|aube>` | Select one manager at cwd; additional installation roots retain their own targets.        |
| `--pm-version <x.y.z>`                    | Supply an exact stable target version (requires `--pm`). It does not run an installed PM. |
| `--project-type <application\|package>`   | Choose whether publication safeguards apply; omitted means infer from publish metadata.   |
| `--exclude <pattern>`                     | Prune discovery directories (repeatable).                                                 |
| `--installation-root <path>`              | Replace installation scope (repeatable; include `.` for cwd).                             |
| `--severity <error\|warn\|info>`          | Set both the display and CI failure threshold; default failure threshold is `error`.      |
| `--reporter <pretty\|json\|github>`       | Choose terminal, JSON, or GitHub Actions output; `--json` is a JSON shortcut.             |

See [configuration and behavior](configuration.md) for PM selection, target-version
precedence, common exclusions, explicit installation scope, executable config, library use, and exit codes. The old `--workspaces` flag is rejected; see [migration](configuration.md#migration-from-05x).

## Install as a dev dependency (optional)

```sh
npm install --save-dev --save-exact @pho9ubenaa/siro
```

Add a script to your existing `package.json` (preserve its other fields):

```json
{
  "scripts": { "lint:security": "siro lint" }
}
```

Run `npm run lint:security` from a shell, `pre-push` hook, or CI after dependency
installation. To pass extra flags, use `npm run lint:security -- --severity warn`.
Installing a dev dependency does not put its binary on the global shell PATH.
For a trusted repository, pass `--pm` when detection cannot identify its manager.

Next: the [rule reference](rules.md) explains each check, the
[comparison matrix](comparison.md) shows per-manager support, and
[json-output.md](json-output.md) documents the machine-readable contract.
