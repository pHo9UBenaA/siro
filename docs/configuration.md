# Configuration and behavior

## Versioning policy

siro evaluates repository settings against the recorded policy snapshot in
[policy-sources.md](policy-sources.md). It detects package-manager names and checks
selected settings against a declared or explicit stable target version. It does
not inspect installed binaries. Defaults that
depend on a version, CI, or a public pull request retain the configured severity
when their setting is absent.

The checks do not resolve command-line flags, environment variables, user/global
configuration, or workspace children into an effective installation policy.
A clean result is not a security attestation. See [threat-model.md](threat-model.md).

## Selection and input

Detection combines `package.json#packageManager`, lockfiles, and manager-specific
configuration files. All detected managers are checked. `.npmrc` alone identifies
no manager because several managers read it. With no detection signal, the CLI
exits `2`; `--pm` selects one manager explicitly and bypasses detection.

`projectType: 'application'` skips published-artifact rules. `'package'` evaluates
them even when metadata is temporarily private. An explicit option overrides
configuration; otherwise siro infers the type from publish metadata (`private`
and `name` in package.json, or `name` in deno.json).

Inspected JSON and YAML files must have object roots. Arrays, scalars, and `null`
are errors. Missing files and empty YAML documents provide no settings; empty
JSON is invalid. `package.json`, when present, must be an object. Supported targets
are listed in [rules.md](rules.md). Lockfile checks inspect presence, not git
tracking or lockfile contents. Deno currently supports strict `deno.json`, not
`deno.jsonc` or external import maps.

Value options must be specified once with a non-empty value. Boolean flags
(`--json`, `--help`, `--version`, `--workspaces`) take no values or `--no-` variants.
`--help` takes precedence over other arguments; `--version` comes next.
Arguments after `--` are rejected.

## Target PM versions

The `unsupported-settings` rule reports settings introduced after the target version.
For example, `packageManager: "npm@11.9.0"` with `min-release-age=3` produces an error:
the setting requires npm 11.10.0. Setting presence is checked even for `false`, zero,
or null values. All affected keys for one manager are grouped in one finding, with
the first affected file as its location and source links in the manual steps.

Targets are resolved separately for each selected manager, in this priority order:

1. CLI `--pm-version` / API `pmVersion`, together with `--pm` / `pm`.
2. `config.pmVersions`, such as `{ npm: '11.10.0', pnpm: '10.16.0' }`.
3. An exact stable `package.json#packageManager` declaration for that manager.

```sh
siro lint --pm npm --pm-version 11.10.0
```

```ts
lint({ cwd, pm: 'pnpm', pmVersion: '10.16.0' });
```

Version maps do not select managers or bypass `pms` restrictions. Lockfiles do not
establish a runtime version. A declaration for npm never supplies pnpm's version.
Versions are exact stable SemVer strings; build metadata, including Corepack's
`+sha512.…` suffix, is accepted and ignored for ordering. Ranges, tags, partial
versions, `v` prefixes, and prereleases are rejected in explicit options/config
with exit 2. Such `packageManager` declarations leave the version unknown, preserving
name detection and existing checks. No PM binary is executed or downloaded.

Only the [listed setting/file pairs](rules.md#checked-introduction-versions) have
availability checks in this release (npm, pnpm, Yarn, Bun). Deno and Aube still have
their existing security checks but no verified introduction table. Unlisted keys,
unknown targets, later removals, backports, and version-specific value syntax are
outside this check. A passing result does not establish that every setting works.
The target is the user's declaration, not proof of what CI actually runs.

The new rule defaults to `error`, so previously passing projects with unsupported
settings can exit 1. It supports the usual `rules` severity override or `'off'`.
Existing security rules and their remediation remain in effect; a target version
does not lower severity for missing settings or prove environment-dependent defaults.

## Workspace members

Use `siro lint --workspaces` or `lint({ cwd, workspaces: true })` to add checks of
declared members' `package.json` publication metadata. The default remains one root.
Run from the workspace root; siro does not search parent directories for it.

- npm, Yarn, and Bun read the root `package.json#workspaces` array. The
  `{ packages: [...] }` form is also accepted.
- pnpm reads `pnpm-workspace.yaml#packages`. An existing workspace file must have
  an explicit array in this mode; implicit package-discovery defaults are not inferred.
- Relative directory patterns support Node's glob matching, including `*`, `**`,
  and braces. Leading `!` excludes matching directory subtrees. Patterns use `/`;
  absolute paths, parent traversal, and backslash patterns are rejected.
- Root `.` entries, duplicate matches, `node_modules`, `.git`, and directory symlinks
  are excluded from member traversal. Directories without `package.json` are skipped.
  Only the root declaration is expanded; nested workspace declarations are not followed.
- Deno and Aube member discovery is not supported in this release. Selecting either
  with `--workspaces` fails explicitly; use `--pm` or `config.pms` to select supported managers.

The root receives the usual checks once. Members reuse `files-field`, `publish-access`,
and the `package.json` entries of `unsupported-settings`; findings identify paths such
as `packages/ui/package.json`. Missing `files` or access settings use their existing
informational severity; overrides and the CLI threshold apply to the combined result.
Malformed selected manifests and directory-read failures stop the command with an error
instead of producing a partial report. The JSON schema remains 2.

Each child infers its own publication status, so a private root does not hide a public
child. An explicit `projectType` applies to both root and children. Members use the
root's selected PM and resolved target version; a child's `packageManager` does not
override the workspace target. Multiple selected managers expand their own declarations.

Installation settings and lockfiles are checked only at the root. Child installation
configs, effective setting inheritance, dependency graphs, and child provenance policy
are outside this inspection. The availability check on `publishConfig.provenance`
establishes only its introduction version, not whether publication emits attestations.
Root custom rules run once; child `siro.config.*` files are never loaded or executed.

Injected `FileSystem` implementations can supply `readDirectories(path)`, returning
ordinary child directory names without symlinks and propagating access errors. It is
required only when member discovery needs directory enumeration. A missing implementation
fails explicitly; siro never falls back to host filesystem reads for a virtual repository.
Native manifest-file symlinks follow the existing file-read behavior.

## Executable CLI configuration

The CLI loads the first existing `siro.config.ts`, `siro.config.mjs`, or
`siro.config.js` in that order. These files run with the caller's privileges.
TypeScript must use erasable syntax supported by the required Node version.

```ts
import { defineConfig } from '@pho9ubenaa/siro';

export default defineConfig({
  projectType: 'application',
  pms: ['npm', 'pnpm'],
  rules: { provenance: 'off', 'pin-exact-versions': 'warn' },
  customRules: [],
  reporters: [],
});
```

`pms` restricts detection and must be non-empty when present. Rule IDs must be
known and unique across built-in and custom rules. Unknown config keys and
malformed extension objects are errors. Config maps must be ordinary objects
or objects with a null prototype; class instances and inherited maps are rejected.

Each call reloads the config entry module. Node still caches its imported
dependencies. This is not a sandbox or a general hot-reload mechanism.

## Library use

The library never discovers or executes repository configuration implicitly.
Pass a `config` object to `lint` for results, or to `lintCommand` for reporting
and an exit code. `fs` supplies all package-manager file reads.

```ts
import { asAbsPath, lint, lintCommand, loadConfig, nodeIO } from '@pho9ubenaa/siro';

const cwd = asAbsPath(process.cwd());
const result = lint({ cwd, config: { projectType: 'application' } });

// Opt into executing a trusted repository's configuration.
const config = await loadConfig(cwd);
const exitCode = await lintCommand({ cwd, config, reporter: 'json' }, nodeIO);
```

Custom rules and reporters belong in `config.customRules` and `config.reporters`.
The former top-level extension options were removed in v0.4.0. `LintOptions`
describes evaluation; `LintCommandOptions` adds `reporter` and `severity`.
Path constructors validate their input: roots must be absolute; repository paths
must be relative and contain no parent traversal. Filesystem symlinks still follow
normal Node behavior. Native filesystem targets must be existing directories;
an injected `FileSystem` defines its own virtual repository namespace.

## Custom checks and remediation

```ts
import { CONFIG_FILES, defineRule, getByPath } from '@pho9ubenaa/siro';

const approval = defineRule({
  id: 'local-approval',
  title: 'Require approval',
  description: 'Require the project approval setting.',
  severity: 'error',
  bindings: {
    npm: {
      file: CONFIG_FILES.npmrc,
      check(_ctx, config) {
        if (getByPath(config, ['local-approval']) === true) return { state: 'ok' };
        return {
          state: 'violation',
          message: 'Enable local approval.',
          remediation: {
            kind: 'automatic',
            operations: [
              { op: 'setKey', file: CONFIG_FILES.npmrc, keyPath: ['local-approval'], value: true },
            ],
          },
        };
      },
    },
  },
});
```

A check returns `ok`, `na`, or one violation, optionally with automatic operations
or manual steps. The engine validates untyped results before reporting them.
The binding receives a `RuleContext`: `pmVersion` is the resolved stable version of
that binding's manager, or `undefined`; `readConfig(file)` reads additional inputs
through the same validated parsers and per-run cache. A violation may return
`file` to identify a different repository-relative input. Otherwise the binding
file is used. A binding may omit `file` when it only needs the repository context.
`fix`, `fixKind`, `AutoRuleBinding`, `AdvisoryRuleBinding`, and `fileGlob` were removed
in v0.4.0. See [json-output.md](json-output.md) for schema 2.

`requireConfigKey` describes one setting and its proposed scalar replacement.
Use a direct binding for multiple settings or precedence-dependent remediation.
The former `extraFix` option is rejected. For example, a bypass may require manual
removal even when setting another key would normally be sufficient.

## Severity and reporters

User `rules` overrides take precedence over result, binding, and rule severities.
`'off'` removes a rule. A `requireConfigKey` binding may use `documentedDefault`
to emit `info` only when an omitted key is safe across every supported package-manager
version and target environment. A `defaultSafeSince` note does not establish that
the effective runtime satisfies the condition: declared targets are used only for
availability checks, so version- or environment-dependent defaults retain the rule's
configured severity. `defaultSatisfiedSeverity: 'off'` suppresses only an
unconditionally safe default; a severity override cannot resurrect a finding the
check did not emit.

`pretty` prints findings and manual steps, `json` emits the versioned document,
and `github` emits workflow annotations. Configured reporters register by name;
later registrations replace earlier ones. An explicit reporter object is also
accepted by `lintCommand`. The exit decision is computed before the reporter runs.

By default all findings are displayed and only `error` fails. `--severity warn`
or `--severity info` changes both display and failure thresholds.

## Exit codes

| Code | Meaning                                                                 |
| ---- | ----------------------------------------------------------------------- |
| `0`  | No findings at or above the failure threshold                           |
| `1`  | Findings at or above the failure threshold                              |
| `2`  | Invalid options, configuration, extension results, or filesystem access |
| `70` | Unexpected exception, including a throwing custom rule or reporter      |

## Public API scope

The package entry exposes evaluation and reporting, explicit configuration loading,
rule and reporter contracts, rule-authoring helpers, validated paths, and error types.
Internal codec selection, detection signals, reporter registries, severity/exit-code
helpers, and metadata/error rendering helpers are not public API in v0.4.0.
Use `lint` for results and `lintCommand` for built-in reporting and thresholds.
Custom checks use `RuleContext` and `getByPath`; custom reporters consume `LintResult`.

## Invalid and unsupported data

Malformed types in the `package.json` fields consumed by siro are configuration errors; they are not replaced with defaults. A Deno project using only `deno.jsonc` fails explicitly because the current parser supports strict `deno.json` only. Error exit code `2` means evaluation did not complete.
