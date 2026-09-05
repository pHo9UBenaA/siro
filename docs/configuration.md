# Configuration and behavior

## Versioning policy

siro evaluates repository settings against the recorded policy snapshot in
[version-matrix.md](version-matrix.md). It detects package-manager names and does
not change rules based on installed or declared versions. Version annotations
are display metadata. Check compatibility before relying on a documented default;
some defaults apply only in CI or public pull requests.

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
A binding may omit `file` when it only needs the repository context.
`fix`, `fixKind`, `AutoRuleBinding`, `AdvisoryRuleBinding`, and `fileGlob` were removed
in v0.4.0. See [json-output.md](json-output.md) for schema 2.

`requireConfigKey` describes one setting and its proposed scalar replacement.
Use a direct binding for multiple settings or precedence-dependent remediation.
The former `extraFix` option is rejected. For example, a bypass may require manual
removal even when setting another key would normally be sufficient.

## Severity and reporters

User `rules` overrides take precedence over result, binding, and rule severities.
`'off'` removes a rule. A `requireConfigKey` binding may use `documentedDefault`
to emit `info` when an omitted key is already safe under the recorded default.
Its `defaultSatisfiedSeverity: 'off'` suppresses that case entirely; a severity
override cannot resurrect a finding the check did not emit.

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
Custom checks use `RepoContext` and `getByPath`; custom reporters consume `LintResult`.
