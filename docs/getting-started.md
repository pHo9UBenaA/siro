# Getting started

## 1. Run a check

Use a supported Node version (see [requirements](../README.md#try-it)) and run from
your repository:

```sh
npx @pho9ubenaa/siro lint
```

`npx` may download the tool. Executable repository configuration is not loaded
automatically; it requires an explicit `--config <path>`. For unfamiliar checkouts,
skip repository configuration and reject symlink
input paths with `npx @pho9ubenaa/siro lint --no-config --strict-filesystem`, in an isolated environment
without credentials. These options are not a sandbox; see the [threat model](threat-model.md).

siro detects managers from `packageManager`, lockfiles and manager-specific config.
If it cannot detect yours, select it explicitly, for example:

```sh
npx @pho9ubenaa/siro lint --pm npm
```

## 2. Choose what to inspect

All selected `package.json` and strict `deno.json` manifests below the current
directory are checked. By default, installation settings are checked only at the
current directory, not every discovered package. PM workspace declarations do
not limit discovery.

To exclude intentional fixtures and generated packages, save `siro.config.mjs`
and select it with `npx @pho9ubenaa/siro lint --config ./siro.config.mjs`:

```js
export default {
  exclude: ['test/fixtures', 'vendor', 'dist'],
};
```

For an independent install project, explicitly add its directory:

```sh
npx @pho9ubenaa/siro lint . --installation-root . --installation-root tools/standalone
```

Replace `tools/standalone` with an existing project. Include `.` to retain the
current directory's installation checks. Additional roots use their own PM targets;
root `--pm` does not propagate. Check the JSON `inspection` field when verifying
scope. See [configuration](configuration.md) for exclusions and manifest-only scans.

## 3. Read findings and adjust your policy

siro reports issues and suggested changes; it does not edit files. By default,
all findings are shown, but only errors cause exit `1`. Warnings and info do not
fail the command unless you select a stricter threshold.

```sh
npx @pho9ubenaa/siro lint --json
npx @pho9ubenaa/siro lint --severity warn
```

Review each change before applying it. For example, before setting
`ignore-scripts=true` in `.npmrc`, check whether your builds need lifecycle scripts.
Rerun lint after editing. JSON findings contain proposed operations or manual
steps; see the [output contract](json-output.md).

To change a rule's severity, add a `rules` map to your existing config:

```js
export default {
  exclude: ['test/fixtures', 'vendor', 'dist'],
  rules: { 'files-field': 'warn' },
};
```

The [rule reference](rules.md) explains the checks and supported managers.
[Rule settings](configuration.md#rule-settings) also support disabling a check
with `'off'`; do this deliberately, not just to obtain a clean result.

## 4. Add a repeatable CI command

Install a pinned dev dependency:

```sh
npm install --save-dev --save-exact @pho9ubenaa/siro
```

Add a script to `package.json`, preserving its other fields:

```json
{
  "scripts": { "lint:security": "siro lint --config ./siro.config.mjs" }
}
```

After installing project dependencies in CI, run:

```sh
npm run lint:security
```

A local dependency is available to package scripts, not every shell or Git hook.
Use `npm run lint:security` in hooks too. To pass extra options:

```sh
npm run lint:security -- --severity warn
npm run lint:security -- --reporter github
```

Do not run an untrusted checkout's executable config in a privileged
`pull_request_target` job. Protect the trusted CI/policy definitions and use a
credential-free, restricted job for data-only scans.

The GitHub reporter emits Actions annotations. Treat [exit codes](configuration.md#severity-reporters-cli-and-exits)
`2` and `70` as failed/incomplete checks, not successful empty results.

For more options, use `npx @pho9ubenaa/siro lint --help` or the
[CLI summary](../README.md#common-cli-options). Upgrading from 0.5.x? Follow the
[migration guide](configuration.md#migration-from-05x); `--workspaces` was removed.
