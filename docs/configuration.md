# Configuration and behavior

## Inspection scope: packages and installation roots

A **package** is a directory with a manifest. A **dependency** is something it
consumes. A PM **workspace** groups packages for that manager; an independent
installation project manages its own dependency installation. The exploration
root (`cwd`), package roots, and installation roots need not coincide.

`siro lint [cwd]` recursively discovers `package.json` and strict `deno.json`,
including cwd. PM workspace declarations do not select, exclude, or stop traversal.
Changing npm/Bun workspace order, Deno `workspace`/`vendor`, or YAML `packages`
does not change discovery. `pnpm-workspace.yaml` and `aube-workspace.yaml` are
still read as installation configuration where applicable.

Manifest-only checks cover `files-field`, npm-format `publish-access`, and the
manifest entries of `unsupported-settings`. Generic publication checks run once
per manifest, even with multiple PM targets, and carry no invented PM. Private or
unnamed packages are normally applications; Deno `name` and `publish: false` are
judged independently of npm metadata, including when both manifests coexist.
An explicit `projectType: 'application' | 'package'` applies to **all** targets,
with API/CLI overriding config. Parent privacy never propagates to children.

**Discovery is not complete installation-policy inspection.** By default only
cwd (`installationRoots: ['.']`) receives local installation checks. Additional
independent installation projects must be explicitly named. siro does not infer
them from `.npmrc`, lockfiles, packageManager, or dependency declarations, and
cannot guarantee detection of omitted installation projects. Inspect the returned
`inspection` scope, not just finding counts.

```ts
import { defineConfig } from '@pho9ubenaa/siro';
export default defineConfig({
  exclude: ['test/fixtures', 'vendor', 'dist'],
  installationRoots: [
    '.',
    'tools/standalone',
    { path: 'tools/no-detection-signal', pm: 'npm', pmVersion: '12.0.2' },
  ],
});
```

```sh
siro lint . --exclude test/fixtures --exclude vendor
siro lint . --installation-root . --installation-root tools/standalone
```

`exclude` defaults to `[]`; `installationRoots` defaults to `['.']`. API options
replace their corresponding config arrays completely. One or more CLI
`--exclude` / `--installation-root` values likewise replace that config array.
Specifying `['tools/a']` does **not** automatically add `.`. `installationRoots: []`
explicitly disables installation checks while keeping manifest checks. Use config
or API for the empty array and for per-root PM/version objects.

Installation paths are literal directories, not globs: a real `tools/*` directory
is not an expansion. They must use exact enumerated spelling, **including case on
all hosts**, inside the selected subtree. Missing paths, files, symlinks (including
intermediate components), excluded paths, `.git`, and `node_modules` are rejected.
Normalized duplicate entries are evaluated once; conflicting PM/version entries
are errors. `.` objects cannot contain PM fields: use the top-level root options.
Arrays must be dense and correctly typed; unknown object keys are errors.

Parent and child installation roots are each evaluated using their own local
settings, not inheritance. A root with no manifest can still receive installation
checks when its PM can be resolved. No synthetic public package is created.
`provenance` also reads PM configuration, so it runs only for publishable packages
at explicit installation roots. **Manifest-only children do not receive effective
provenance-policy evaluation.** Availability of `publishConfig.provenance` is a
separate question from whether publishing emits attestations.

## Common exclusions and filesystem behavior

One case-sensitive, lexical dialect applies on every OS:

- Patterns use `/` and support `*`, `?`, and whole-component `**`. Dot directories
  are ordinary candidates. Braces, character classes and extglob punctuation are
  literal, not additional operators.
- `test/fixtures` and `test/fixtures/**` both prune that directory and its entire
  subtree **before manifest reads or child enumeration**.
- cwd itself is always included. `exclude: ['**']` keeps only cwd;
  `exclude: ['.']` is an error.
- Leading `!` reinclusion is rejected; order cannot re-add excluded directories.
  Absolute paths, `..` components, NUL, backslash patterns and engine limits are
  configuration errors. Literal installation input never interprets wildcard characters and must match
  a host-validated enumerated path. POSIX backslashes/colons within a native
  component are preserved (for example `scratch\\notes` or `C:notes`); they are
  not Windows path separators or drive aliases.
- Ordinary children named `.git` or `node_modules` are always skipped. Directory
  symlinks are never followed below cwd. `dist`, `examples`, fixtures, `vendor`,
  `CMakeFiles`, and dot directories have no other implicit exceptions.
- `.gitignore`, tracked-file lists and PM exclusions are not consulted.

Selected malformed manifests, JSONC-only directories, and directory/read errors
fail the entire run; no successful partial report is emitted. If both `deno.json`
and `deno.jsonc` exist, strict `deno.json` takes precedence. Intentionally broken
fixtures require explicit exclusion. JSON/YAML configuration roots must be
objects; empty YAML supplies no settings, while empty JSON is invalid. Consumed
package.json fields, including `publishConfig.provenance`, are type-validated.
Lockfile rules check presence, not git tracking or lockfile contents.

Injected `FileSystem.readDirectories` is **required**. Return a dense array of
ordinary native child directory names without symlinks; no host filesystem
fallback exists. Empty names, `.`, `..`, NUL, nonstrings and native separators
are rejected. On POSIX, literal `scratch\notes` and `C:notes` names are valid;
`scratch\notes` and `scratch/notes` remain distinct in reads and output. Public
output paths preserve native component spelling, joining components with `/`.
Do not blindly replace backslashes in reported paths.

`readText` and `exists` accept regular files, including file symlinks. Only ENOENT
means absence; access errors and non-file entries must throw. The explicitly
chosen cwd itself uses normal native directory resolution, including a symlink.
Manifest-file symlinks retain normal reads: this is **not a containment sandbox**.

Within a call, each directory has one shared context and parser for discovery,
manifest checks and installation checks. Successful reads (including absence)
and successful parses keyed by `(kind, relative path)` are reused. Typed manifest
validation and JSON parsing share raw bytes. Failures propagate; they are not
cached as absence. Other directories and later calls have fresh caches. Existence
checks remain live; this is not a filesystem-wide atomic snapshot.

## Target PM versions

PM names and versions are local policy declarations, not attestation of an
installed or executed binary. No PM executable is run or downloaded.

| Evaluation directory                     | PM selection                                                                         | Version precedence                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| cwd installation/custom checks           | root `pm` / `--pm`, otherwise local detection; root config `pms` restricts selection | root `pmVersion` → config `pmVersions[pm]` → local exact `packageManager` |
| Additional installation root             | entry `pm`, otherwise local detection                                                | entry `pmVersion` → its own exact `packageManager`                        |
| Manifest at an installation root         | that directory's targets, filtered for manifest format                               | same local versions                                                       |
| cwd manifest without installation checks | optional root selection/detection                                                    | root precedence above                                                     |
| Other discovered manifest                | its own manifest declaration; Deno format identifies Deno with unknown version       | its own exact stable declaration only                                     |

Local detection combines `packageManager`, lockfiles and manager-specific config
presence. `.npmrc` alone identifies no PM. Root `pms` is a nonempty **restriction**,
not a list of forced targets. Version maps never select PMs. Root flags/config
never propagate to additional roots or publication-only children, and npm versions
never become Deno versions.

For example, cwd `--pm npm --pm-version 9.4.0` does not override a discovered
child's `npm@12.0.2`, nor an additional root's explicit pnpm target. A publication-only
package without a declaration still gets generic publication checks; its empty
target list means availability was **not evaluated**, not that settings are safe.
A target without `version` likewise has unknown availability. Installation roots
with no detectable/explicit PM fail with a path-specific error. Active custom
rules require a cwd PM; all-off custom rules do not. With `installationRoots: []`,
root PM options can select manifest policy without re-enabling installation checks.

Explicit versions require a PM and exact stable SemVer. Build metadata (including
Corepack `+sha512.…`) is accepted. Ranges, prereleases, tags, partial versions and
`v` prefixes in explicit options/config are errors. Such manifest declarations
leave the version unknown while retaining manager-name detection where possible.

`unsupported-settings` checks only the [verified introduction table](rules.md#checked-introduction-versions).
Unknown targets, unlisted keys, later removals, backports and version-specific value
grammars are outside that check. It defaults to error and accepts severity/off
overrides. Remediation for a known too-old target becomes manual upgrade guidance;
missing settings do not become safe just because a new version was declared.

## Local policy, not effective runtime configuration

siro does not resolve environment variables, user/global configuration, CI
commands, install/publish flags, dependency graphs or workspace inheritance into
an effective policy. All checks use the explicitly selected local inputs.
A clean result is not a security attestation; see [threat-model.md](threat-model.md).

For npm provenance, own `package.json#publishConfig.provenance` overrides local
`.npmrc#provenance`, including false. The finding and remedy target the responsible
file; unrelated publishConfig keys are preserved. This precedence is not assumed
for other PMs. Deno's valid object with absent/null age uses local `.npmrc` fallback;
without a positive active fallback it retains configured severity. Explicit inactive
or invalid age is not rescued by fallback, and zero fallback is an opt-out.

## Executable CLI configuration

The CLI loads only cwd's first existing `siro.config.ts`, `.mjs`, or `.js`, in that
order, once per invocation. It runs with the caller's privileges. TypeScript must
use Node-supported erasable syntax. Child package and additional installation-root
configs are **not** automatically loaded or executed. No parent/global search is
added. Entry modules reload between calls; imported dependencies remain subject
to Node's cache. This is neither a sandbox nor general hot reload.

Unknown config keys, unknown/duplicate rule IDs and malformed extensions are
errors. Maps must be plain or null-prototype objects, not inherited/class maps.
Custom rules run only at cwd, once per selected binding. All targets share root
rule overrides and reporters.

## Library use

`lint` is synchronous. `lintCommand` is async and awaits reporters. Neither imports
executable repository configuration implicitly. Use `loadConfig` explicitly only
for a trusted repository:

```ts
import { asAbsPath, lint, lintCommand, loadConfig, nodeIO } from '@pho9ubenaa/siro';
const cwd = asAbsPath(process.cwd());
const result = lint({
  cwd,
  exclude: ['test/fixtures'],
  installationRoots: ['.', 'tools/standalone'],
});
const config = await loadConfig(cwd); // explicitly executes trusted code
const exitCode = await lintCommand({ cwd, config, reporter: 'json' }, nodeIO);
```

Custom checks/reporters belong in `config.customRules`/`config.reporters`. Public
path constructors validate user paths; native filesystem discovery has a separate
component-validation boundary. Private consumers must use the public package
entry, not internal ports.

## Custom checks and remediation

`defineRule` describes PM bindings. Each check receives a `RuleContext` with local
`pmVersion` and cached `readConfig(file)`, returning `ok`, `na`, a violation, or
`{ state: 'violations', violations: [first, ...rest] }`. Each violation has its own
message, optional severity/file, actual/expected values and remediation. Empty,
sparse, nested or malformed groups fail before reporting. A missing file uses the
binding file, if any; file-less checks do not acquire a synthetic manifest path.

Rules return context-relative paths. Results carry cwd-relative `file` and every
`operations[].file.path`, plus the evaluation `directory` (`.` for cwd). Rebasing
is immutable and happens after availability guards. Manual instructions receive
child directory context once. See [JSON schema 3](json-output.md).

`requireConfigKey` describes a scalar setting and remedy. `documentedDefault`
specifies a value; **`defaultSafety: 'unconditional'`** explicitly permits that
value to lower omitted-setting severity if it satisfies the requirement.
`'conditional'` and omitted safety preserve configured severity. `VersionNote`
is display-only: editing `defaultSafeSince` cannot change policy. Conditional
version/CI/environment defaults remain conservative even for a new declared PM.
`defaultSatisfiedSeverity` defaults to info, or can be off; an override cannot
resurrect a finding the check never emitted. Use direct bindings for precedence
or multi-setting behavior. The former `extraFix` option is rejected.

## Severity, reporters, CLI and exits

User rule overrides outrank result, binding and rule severities; off removes a
rule. By default all findings are displayed but only errors fail. `--severity`
changes both display and failure thresholds. Summary counts displayed findings,
not inspected inputs; filtering preserves `inspection`. Exit is decided before
reporters run. Pretty shows generic findings as `[package]` plus scope information;
JSON emits one document; GitHub emits escaped violation annotations, not fake scope
violations. Registered reporters can replace built-ins by name. Async rejection,
sync throws and partial-output failures propagate.

`check` aliases `lint`. Value options must be nonempty. Only `--exclude` and
`--installation-root` repeat; other value flags occur once. Boolean `--json`,
`--help`, `--version` take no values or `--no-` variants. Help has first priority,
version second. Arguments after `--` are rejected.

## Exit codes

| Exit | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| 0    | No findings meet the failure threshold                                     |
| 1    | Findings meet the threshold                                                |
| 2    | Invalid options/config/results or filesystem access; inspection incomplete |
| 70   | Unexpected exception, including custom rule/reporter failure               |

## Migration from 0.5.x

- Remove `--workspaces` / `workspaces`, which now fail explicitly, even
  `workspaces: false`. This is **not a rename**: discovery is always recursive and
  old PM exclusions no longer hide fixtures or vendor/dist packages. Add siro
  `exclude` patterns; `['**']` approximates former root-only inspection.
- Add independent `installationRoots` deliberately; discovery does not add them.
- Stop relying on root PM/version inheritance or duplicated generic PM findings.
- Consume schema 3: optional finding PM, required directory and inspection scope.
- Injected filesystems must implement `readDirectories`; `resolveDirectory` is removed.
- Custom `requireConfigKey` defaults without `defaultSafety` are now conservative.
