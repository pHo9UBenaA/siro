# Getting started

## Run without installing

```sh
npx @pho9ubenaa/siro lint       # latest
npx @pho9ubenaa/siro@v0.0.3 lint # pin to a specific version
```

`siro` auto-detects your package manager from the `packageManager` field, lockfiles, and config
files, then reports any best-practice violations.

## Fix the findings

siro is a linter: it reports violations but never writes your config files.
Every finding carries machine-readable remediation (`fix` operations and
`manualSteps`) in the JSON output:

```sh
npx @pho9ubenaa/siro lint --reporter json
```

Apply the `fix` operations with your editor — or hand the JSON to an agent
skill that edits the files and re-runs `siro lint` until it exits `0`. The
output shape is a versioned contract; see [json-output.md](json-output.md).

## Add it to CI

```sh
npx @pho9ubenaa/siro@v0.0.3 lint                     # pin version in CI
npx @pho9ubenaa/siro lint --severity warn            # also fail on warnings
npx @pho9ubenaa/siro lint --reporter json            # machine-readable output (equivalent to --json)
npx @pho9ubenaa/siro lint --reporter github          # GitHub Actions annotations on PRs
```

## Target a specific package manager

```sh
npx @pho9ubenaa/siro@v0.0.3 lint --pm pnpm
```

## Install as a dev dependency (optional)

```sh
npm install --save-dev --save-exact @pho9ubenaa/siro     # npm
pnpm add --save-dev --save-exact @pho9ubenaa/siro        # pnpm
yarn add --dev --exact @pho9ubenaa/siro                  # yarn
```

Then wire `siro lint` into your `pre-push` hook or CI workflow.

Next: the [rule reference](rules.md) explains each check, the
[comparison matrix](comparison.md) shows per-manager support, and
[json-output.md](json-output.md) documents the machine-readable contract.
