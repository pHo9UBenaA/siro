# Configuration and behavior

## Rule settings

Save `siro.config.mjs` in the directory you pass to `lint`. No import is required,
so this example also works with `npx` without a local siro dependency:

```js
export default {
  exclude: ['test/fixtures', 'vendor', 'dist'],
  rules: {
    'files-field': 'warn',
    provenance: 'error',
    'store-server': 'off', // Omit this advisory only after reviewing your policy.
  },
};
```

Rules run at their built-in severities unless overridden. Allowed values are
`'error'`, `'warn'`, `'info'`, and `'off'`. Off disables the check, not just its
output. Unknown rule IDs are errors. Overrides apply to all selected directories;
`--severity` separately controls display and failure thresholds.

| Field               | Value and purpose                                                               |
| ------------------- | ------------------------------------------------------------------------------- |
| `exclude`           | Directory patterns; defaults to `[]`.                                           |
| `installationRoots` | Paths or `{ path, pm?, pmVersion? }` entries; defaults to `['.']`.              |
| `rules`             | Map of built-in or registered custom rule IDs to severity or `'off'`.           |
| `pms`               | Nonempty array restricting cwd's PM selection; does not force detection.        |
| `pmVersions`        | Map such as `{ npm: '12.0.2' }`; declares versions for cwd.                     |
| `projectType`       | `'application'` or `'package'`; overrides inference for all selected manifests. |
| `customRules`       | Array of custom rules; run only at cwd.                                         |
| `reporters`         | Array of `{ name, format }` reporters; can replace built-ins by name.           |

For TypeScript completion, first install siro in the project with
`npm install --save-dev --save-exact @pho9ubenaa/siro`, then use `siro.config.ts`:

```ts
import { defineConfig } from '@pho9ubenaa/siro';
export default defineConfig({
  rules: { provenance: 'error' },
});
```

An `npx` temporary installation does not make imports from your repository's
config resolvable. Without a local dependency, use the import-free `.mjs` form.

## Inspection scope: packages and installation roots

`siro lint [cwd]` discovers `package.json` and strict `deno.json` recursively,
including cwd. PM workspace declarations and exclusions do not select packages
or stop traversal. Use siro's `exclude` option to omit directories.

Each selected manifest receives applicable publication checks: `files-field`,
npm-format `publish-access`, and manifest setting-availability checks. Generic
checks run once per manifest, even with multiple PM targets. Private or unnamed
packages are normally applications. Deno's `name` and `publish: false` are judged
independently of npm metadata; parent privacy never propagates to children.
An explicit `projectType` applies to all selected manifests, with API/CLI options
overriding config.

**Discovery does not inspect every package's installation policy.** By default,
only cwd receives installation checks. List other independently installed projects
explicitly; siro does not infer them from lockfiles or PM declarations. For example,
adapt these paths to existing directories in your repository:

```js
export default {
  exclude: ['test/fixtures', 'vendor', 'dist'],
  installationRoots: [
    '.',
    'tools/standalone',
    { path: 'tools/no-detection-signal', pm: 'npm', pmVersion: '12.0.2' },
  ],
};
```

```sh
npx @pho9ubenaa/siro lint . --installation-root . --installation-root tools/standalone
```

- `exclude` defaults to `[]`; `installationRoots` defaults to `['.']`.
- API arrays replace their config values. Repeated CLI `--exclude` or
  `--installation-root` values likewise replace the corresponding config array.
- Naming a child does not automatically retain `.`. `installationRoots: []`
  disables installation checks while keeping manifest checks; use config or API
  to supply an empty array or per-root PM/version objects.
- Installation paths are literal, cwd-relative directories, not globs. They must
  match exact spelling, including case on all hosts. Missing, excluded, symlinked
  or hard-skipped directories are rejected. Normalized duplicates run once;
  conflicting duplicate options are errors.
- The `.` entry cannot contain PM options; use root API/CLI options or config
  `pms` / `pmVersions` instead.

Each installation root uses its own local settings, not inherited settings.
A root without a manifest can receive installation checks if its PM is known.
`provenance` runs only for publishable packages at installation roots:
manifest-only children do not receive provenance-policy evaluation. Review the
returned `inspection` record to see the selected inputs.

## Common exclusions and filesystem behavior

Exclusions use one case-sensitive dialect on every OS:

- Use `/`, `*`, `?`, and whole-component `**`. Braces, character classes and
  extglob punctuation are literal. Backslash patterns are rejected.
- `test/fixtures` and `test/fixtures/**` both exclude that directory and its entire
  subtree before files are read. `exclude: ['**']` keeps only cwd.
- cwd cannot be excluded with `.`. Leading `!` reinclusion, absolute paths,
  parent traversal (`..`), NUL and patterns exceeding matcher limits are errors.
- `.git` and `node_modules` directories are always skipped. Other directories,
  including dot directories, `dist`, `vendor` and fixtures, have no implicit exclusions.
- `.gitignore`, tracked-file lists and PM workspace exclusions are not consulted.

Directory symlinks below cwd are not followed. cwd itself and file symlinks use
normal native filesystem resolution; this is not a containment sandbox. Native
filename spelling is preserved in results, including POSIX backslashes. See
[output paths](json-output.md#paths-and-remediation) before consuming them.

Selected malformed manifests, unsupported JSONC-only directories and read errors
fail the entire scan. If both `deno.json` and `deno.jsonc` exist, strict `deno.json`
takes precedence. Exclude intentionally broken fixtures. JSON/YAML roots must be
objects; empty YAML is accepted, but empty JSON is invalid. Consumed manifest
fields are type-checked even when publication checks are disabled; unknown fields
are not whole-schema validated. Lockfile checks establish file presence, not git
tracking, content validity or freshness.

Do not modify inputs during a scan; a consistent filesystem snapshot is not guaranteed.

## Target PM versions

Targets describe your intended policy; siro does not run or download a PM binary.

| Evaluation directory         | PM selection                                                                   | Version precedence                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| cwd                          | API `pm` / `--pm`, otherwise local detection; config `pms` restricts selection | API `pmVersion` / `--pm-version` → config `pmVersions[pm]` → local exact `packageManager` |
| Additional installation root | Entry `pm`, otherwise local detection                                          | Entry `pmVersion` → local exact `packageManager`                                          |
| Other discovered package     | Its own manifest declaration; Deno format identifies Deno                      | Its own exact stable declaration only                                                     |

Manifest targets are filtered for their format: Deno for `deno.json`, other PMs
for `package.json`. Local detection combines `packageManager`, lockfiles and
manager-specific configuration presence. `.npmrc` alone identifies no PM.
`pms` restricts selection rather than forcing managers; version maps do not select
managers. Root options never propagate to additional roots or child manifests.

A publication-only package without a known PM still receives generic checks.
An empty target list or a target without a version means availability was not
assessed, not that its settings are safe. Installation roots and active custom
rules require a detectable or explicit PM. Without installation or active custom
checks, cwd's target can be unknown. Root PM options remain usable with
`installationRoots: []` without re-enabling installation checks.

Explicit versions must be exact stable SemVer; `pmVersion` requires `pm`.
Build metadata, including Corepack hashes, is accepted. Ranges, prereleases,
tags, partial versions and `v` prefixes are rejected in explicit options/config.
Such manifest declarations leave the version unknown while retaining name detection
where possible.

`unsupported-settings` checks only the [listed setting/file pairs](rules.md#checked-introduction-versions).
Unknown targets, unlisted settings, later removals, backports and version-specific
value grammars are outside this rule. Known too-old targets receive manual upgrade
guidance rather than unsupported automatic remedies.

## Local policy, not effective runtime configuration

Checks use local files, not environment variables, user/global configuration,
install/publish commands or workspace inheritance. PM-specific precedence and
exceptions are described in [policy and sources](policy-sources.md), including
npm provenance, Deno release-age fallback and npm shrinkwrap compatibility.

## Executable CLI configuration

The CLI loads cwd's first existing `siro.config.ts`, `.mjs`, or `.js`, in that
order. It does not search parents or load child/additional-root executable configs.
Config runs with the caller's privileges; see the [threat model](threat-model.md).
TypeScript must use Node-supported erasable syntax.

Unknown keys, unknown/duplicate rule IDs and malformed extensions are errors.
Config exports and check results must be synchronous objects, not Promises or
thenables. Config maps must be plain or null-prototype objects. Reporters may be
async. All selected targets share cwd's rule overrides and reporter registration.

## Library use

Install siro as a project dependency before importing it. `lint` is synchronous;
`lintCommand` evaluates and reports asynchronously. Neither implicitly executes
repository configuration. Use `loadConfig` only for trusted code; it reloads the
entry module, not its imported dependencies.

This example assumes `tools/standalone` is an existing independent install project:

```ts
import { asAbsPath, lint, lintCommand, loadConfig, nodeIO } from '@pho9ubenaa/siro';
const cwd = asAbsPath(process.cwd());
const config = await loadConfig(cwd); // Explicitly executes trusted code.
const options = {
  cwd,
  config,
  exclude: ['test/fixtures'],
  installationRoots: ['.', 'tools/standalone'],
};
const result = lint(options); // Returns findings without reporting.
const exitCode = await lintCommand({ ...options, reporter: 'json' }, nodeIO); // Evaluates again.
```

Custom checks and reporters belong in `config.customRules` and `config.reporters`.
Use the public `@pho9ubenaa/siro` entry point; internal modules are not supported APIs.

### Injected filesystems

The optional `fs` implements the exported `FileSystem` interface:

- `readDirectories(directory)` is required. Return a dense array of ordinary native
  child directory names, without symlinks, path separators, empty names, `.`, `..`
  or NUL. POSIX backslashes/colons are valid native name characters. There is no
  fallback to the host filesystem when this method is missing.
- `readText(path)` returns text or `undefined` for absence; `exists(path)` returns
  whether a regular file exists. File symlinks are accepted.
- Only ENOENT means absence. Access errors and non-file entries must throw.

### Custom checks and remediation

Use `defineRule` for PM-specific checks or `requireConfigKey` for a scalar setting.
A check receives `RuleContext`, including optional `pmVersion` and `readConfig(file)`.
Return `ok`, `na`, a violation, or a nonempty `violations` group. Violations contain
`message` and optional `file`, `severity`, `actual`, `expected`, and `remediation`.
Invalid or async results are configuration errors. Rules run only at cwd.

Rule file paths are context-relative; reported file and operation paths are
cwd-relative. A missing violation file uses the binding's file, if any.
See [JSON output](json-output.md) for remediation shapes and path handling.

For `requireConfigKey`, `documentedDefault` may reduce omitted-setting severity
only with `defaultSafety: 'unconditional'` and a default satisfying the requirement.
Omitted safety or `'conditional'` keeps configured severity. `defaultSatisfiedSeverity`
is `'info'` unless specified, and may be `'off'`. A severity override cannot restore
a finding the check never emitted. `VersionNote` is descriptive, not a policy switch.

## Severity, reporters, CLI and exits

User rule overrides take precedence over result, binding and rule severity.
By default all findings are displayed but only errors fail. `--severity` changes
both thresholds. Summary counts displayed findings; filtering does not change
`inspection`. A reporter cannot change the already computed findings exit code,
but reporting failures reject the command.

Built-in reporters are `pretty`, `json` and `github`; registered reporters may
replace them by name. Reporters receive `format(result, io, { cwd })` and must be
awaited, including direct calls. GitHub annotation files are absolute paths based
on this scan cwd; API/JSON paths remain cwd-relative.

`IO.stdout` / `stderr` may return promises. Await direct writes and handle rejection;
synchronous return values are ignored. Reporters must finish their writes before
returning. `lintCommand` waits for its reporter and supplied-IO writes. Output
failure rejects the API and exits the CLI with `70`, not the findings exit `1`.

`check` aliases `lint`. Value options must be nonempty; only `--exclude` and
`--installation-root` repeat. Boolean flags take no values or `--no-` variants.
Help takes priority over version, and version over linting. Arguments after `--`
are rejected. Run `npx @pho9ubenaa/siro lint --help` for CLI syntax.

| Exit | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| 0    | No findings meet the failure threshold                                     |
| 1    | Findings meet the threshold                                                |
| 2    | Invalid options/config/results or filesystem access; inspection incomplete |
| 70   | Unexpected exception, including output, custom-rule or reporter failure    |

## Migration from 0.5.x

- Remove `--workspaces` / `workspaces`, even `workspaces: false`. Discovery is now
  recursive; PM exclusions no longer hide fixtures or vendor/dist packages. Add
  siro `exclude` patterns; `['**']` keeps only cwd.
- Add independent `installationRoots` deliberately; discovery does not add them.
- Stop relying on root PM/version inheritance or duplicated generic PM findings.
- Consume schema 3: optional finding PM, required directory and inspection scope;
  all finding and operation paths are cwd-relative.
- Injected filesystems must implement `readDirectories`; `resolveDirectory` is removed.
- Custom `requireConfigKey` defaults without `defaultSafety` are conservative.
- Direct reporter calls require context and awaiting:
  `await githubReporter.format(result, io, { cwd })`. Two-argument custom
  implementations may ignore context, but callers must supply it.
- `IO.stdout` / `stderr`, including `nodeIO`, may now return promises. Await direct
  writes and handle rejection. Finish reporter writes before returning.
