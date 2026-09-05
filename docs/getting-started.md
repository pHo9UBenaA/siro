# Getting started

## Run without installing

```sh
npx @pho9ubenaa/siro lint
```

`siro` auto-detects your package manager from the `packageManager` field, lockfiles, and config
files, then reports any best-practice violations.

## Fix the findings

siro is a linter: it reports violations but never writes your config files.
Every finding carries machine-readable remediation (`remediation`) in the JSON output:

```sh
npx @pho9ubenaa/siro lint --reporter json
```

Review and apply the proposed operations or manual steps with your editor — or hand the JSON to an agent
skill that edits the files and re-runs `siro lint` until it exits `0`. The
output shape is a versioned contract; see [json-output.md](json-output.md).

## Add it to CI

```sh
npx @pho9ubenaa/siro lint                            # fails (exit 1) on any error-level finding
npx @pho9ubenaa/siro lint --severity warn            # also fail on warnings
npx @pho9ubenaa/siro lint --reporter json            # machine-readable output (equivalent to --json)
npx @pho9ubenaa/siro lint --reporter github          # GitHub Actions annotations on PRs
```

## Target a specific package manager

```sh
npx @pho9ubenaa/siro lint --pm pnpm
```

## Select application or package policy

```sh
npx @pho9ubenaa/siro lint --project-type application # skip published-artifact rules
npx @pho9ubenaa/siro lint --project-type package     # require published-artifact safeguards
```

Omit the flag to infer the policy from the repository's publish metadata.

## Install as a dev dependency (optional)

```sh
npm install --save-dev --save-exact @pho9ubenaa/siro
```

Then wire `siro lint` into your `pre-push` hook or CI workflow.

Next: the [rule reference](rules.md) explains each check, the
[comparison matrix](comparison.md) shows per-manager support, and
[json-output.md](json-output.md) documents the machine-readable contract.
