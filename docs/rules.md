<!-- AUTO-GENERATED from the rule registry. Run `pnpm gen:docs` to update. -->
# Rule reference

Each rule encodes one security intent. Generic publication checks do not need a PM;
installation checks and setting availability use local PM targets. See the
[comparison matrix](comparison.md) for which PMs each rule applies to.
A check may read files beyond its listed primary input. Your configuration and the
observed settings can change the severity shown below. Version notes describe PM
support; siro does not inspect installed binaries. See [policy sources](policy-sources.md)
for defaults, precedence and version limits.

| Severity | Meaning |
| --- | --- |
| `error` | Fails `siro lint` by default. |
| `warn` | Strongly recommended hardening. Fails with `--severity warn`. |
| `info` | Good hygiene; advisory. |

## `advisory-check` — warn

Query the OSV database for known-malicious packages during dependency resolution.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/security.html) |

## `approved-git-repos` — warn

Restrict git: protocol dependencies to an explicit allowlist of approved repository URL patterns.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 4.14.0) | [official docs](https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories) |

## `audit-suppression` — info

Flag audit advisory suppressions that may silently hide future vulnerabilities via broad glob patterns.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | info | — | [official docs](https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories) |

## `block-auto-install` — warn

Disable auto-install so dependencies are only installed through an explicit install step where security guards apply.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://bun.sh/docs/runtime/bunfig#install-auto>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `bun` | `bunfig.toml` | warn | — | [official docs](https://bun.sh/docs/runtime/bunfig#install-auto) |

## `block-exotic-subdeps` — warn

Refuse to install transitive dependencies sourced from git or tarball URLs, which bypass registry integrity checking.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://pnpm.io/settings/dependency-resolution#blockexoticsubdeps>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | (default safe since npm 12.0.0) | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#allow-git) |
| `pnpm` | `pnpm-workspace.yaml` | warn | (available since pnpm 10.26.0; default safe since pnpm 10.26.0) | [official docs](https://pnpm.io/settings/dependency-resolution#blockexoticsubdeps) |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/security.html) |

## `bun-security-scanner` — info

Bun supports a Security Scanner API that intercepts new packages at install time (e.g. Socket Firewall).
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#preinstall-scanners>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `bun` | `bunfig.toml` | info | (available since bun 1.2.21) | [official docs](https://bun.com/docs/pm/security-scanner-api) |

## `checksum-verification` — warn

Throw on checksum mismatches so tampered or corrupted packages are never silently installed.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://yarnpkg.com/configuration/yarnrc#checksumBehavior>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | warn | — | [official docs](https://yarnpkg.com/configuration/yarnrc#checksumBehavior) |

## `commit-lockfile` — error

Lockfiles pin the full dependency tree and integrity hashes, enabling reproducible, verifiable installs (e.g. `npm ci`).
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#3-include-lockfiles>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | Repository | error | — | [official docs](https://docs.npmjs.com/cli/v12/configuring-npm/package-lock-json) |
| `pnpm` | Repository | error | — | [official docs](https://pnpm.io/git#lockfiles) |
| `yarn` | Repository | error | — | [official docs](https://yarnpkg.com/getting-started/qa#should-lockfiles-be-committed-to-the-repository) |
| `bun` | Repository | error | — | [official docs](https://bun.com/docs/install/lockfile) |
| `deno` | `deno.json` | error | (available since deno 1.28.0) | [official docs](https://docs.deno.com/runtime/reference/deno_json/#lockfile) |
| `aube` | Repository | error | — | [official docs](https://github.com/aubepkg/aube/blob/main/docs/package-manager/lockfiles.md) |

## `dependency-overrides` — info

Flag dependency overrides that can replace transitive packages with arbitrary versions or forks — a supply-chain injection vector.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://pnpm.io/settings/dependency-resolution#overrides>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/settings/dependency-resolution#overrides) |
| `aube` | `aube-workspace.yaml` | info | — | [official docs](https://aube.sh/settings/) |

## `disable-lifecycle-scripts` — error

Malicious postinstall scripts are a primary supply-chain attack vector. Prevent automatic execution of dependency lifecycle scripts.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#1-disable-lifecycle-scripts>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | error | — | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts) |
| `pnpm` | `pnpm-workspace.yaml` | error | (available since pnpm 10.3.0; default safe since pnpm 11.0.0; pnpm-workspace.yaml settings require pnpm 10.6.0) | [official docs](https://pnpm.io/settings/build#strictdepbuilds) |
| `yarn` | `.yarnrc.yml` | error | (available since yarn 2.0.0; default safe since yarn 4.14.0) | [official docs](https://yarnpkg.com/configuration/yarnrc#enableScripts) |
| `bun` | `bunfig.toml` | info | (available since bun 1.2.0) | [official docs](https://bun.com/docs/pm/lifecycle) |
| `aube` | `aube-workspace.yaml` | error | — | [official docs](https://aube.jdx.dev/security.html) |

## `enforce-strict-ssl` — warn

Require SSL certificate validation so registry traffic cannot be intercepted or tampered with.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | — | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl) |
| `yarn` | `.yarnrc.yml` | warn | — | [official docs](https://yarnpkg.com/configuration/yarnrc#enableStrictSsl) |

## `files-field` — info

An explicit `files` array in package.json restricts what gets published, preventing accidental inclusion of secrets or local files.
Inspection scope: Every discovered manifest.
Applies to: package.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#12-review-published-files>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `pnpm` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `yarn` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `bun` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `deno` | `deno.json` | info | — | [official docs](https://docs.deno.com/runtime/reference/deno_json/#publish---override-.gitignore) |
| `aube` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |

## `frozen-lockfile` — warn

Refuse to mutate the lockfile on install so unexpected dependency changes fail loudly.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#3-include-lockfiles>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | warn | — | [official docs](https://pnpm.io/cli/install#--frozen-lockfile) |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 2.0.0; default safe since yarn 3.0.0 in CI) | [official docs](https://yarnpkg.com/configuration/yarnrc#enableImmutableInstalls) |
| `bun` | `bunfig.toml` | warn | (available since bun 0.6.10) | [official docs](https://bun.com/docs/runtime/bunfig#install-frozenlockfile) |
| `deno` | `deno.json` | warn | — | [official docs](https://docs.deno.com/runtime/reference/deno_json/#lockfile) |
| `aube` | Repository | info | — | [official docs](https://github.com/aubepkg/aube/blob/main/docs/cli/ci.md) |

## `frozen-store` — info

Consider read-only store access for deployments whose dependencies are already present.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://pnpm.io/settings/store#frozenstore>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | (available since pnpm 11.7.0) | [official docs](https://pnpm.io/settings/store#frozenstore) |

## `hardened-mode` — warn

Yarn 4's enableHardenedMode performs end-to-end checksum, lockfile, and version verification at install time.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://yarnpkg.com/configuration/yarnrc#enableHardenedMode>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 4.0.0; default safe since yarn 4.0.0 (conditional: auto-enabled for PRs on public repositories)) | [official docs](https://yarnpkg.com/configuration/yarnrc#enableHardenedMode) |

## `minimum-release-age` — warn

Refuse to install releases newer than a cooldown window so freshly published (possibly compromised) versions are skipped.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#2-set-cooldowns--minimum-release-age>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | (min-release-age available since npm 11.10.0) | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#min-release-age) |
| `pnpm` | `pnpm-workspace.yaml` | warn | (available since pnpm 10.16.0; default safe since pnpm 11.0.0 (1440 minutes)) | [official docs](https://pnpm.io/settings/dependency-resolution#minimumreleaseage) |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 4.10.0; default safe since yarn 4.15.0 (1440 minutes)) | [official docs](https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate) |
| `bun` | `bunfig.toml` | warn | (available since bun 1.3.0) | [official docs](https://bun.com/docs/runtime/bunfig#install-minimumreleaseage) |
| `deno` | `deno.json` | warn | (default safe since deno 2.9.0 (1440 minutes); object age may be omitted; project .npmrc fallback available since deno 2.8.1) | [official docs](https://docs.deno.com/runtime/reference/deno_json/) |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.sh/settings/) |

## `named-registries` — info

Flag named registry mappings that redirect package resolution to custom registries, which may enable dependency confusion attacks.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://pnpm.io/settings/dependency-resolution#namedregistries>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/settings/dependency-resolution#namedregistries) |

## `paranoid-mode` — info

Activate the strict-security setting bundle that forces trustPolicy, jailBuilds, minimumReleaseAgeStrict, strictStoreIntegrity, strictDepBuilds, and advisoryCheck on in one switch.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | info | — | [official docs](https://aube.jdx.dev/security.html) |

## `patched-dependencies` — info

Review local patches separately from the registry artifacts they modify.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://pnpm.io/cli/patch#patcheddependencies>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/cli/patch#patcheddependencies) |

## `pin-exact-versions` — error

Semver ranges (^, ~) auto-adopt new releases, including compromised ones. Save exact versions by default; for Deno, inspect registry mappings in both inline imports and scopes (not external import maps).
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#4-pin-dependency-versions>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | error | — | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#save-exact) |
| `pnpm` | `pnpm-workspace.yaml` | error | — | [official docs](https://pnpm.io/settings/other#saveprefix) |
| `yarn` | `.yarnrc.yml` | error | (available since yarn 2.0.0) | [official docs](https://yarnpkg.com/configuration/yarnrc#defaultSemverRangePrefix) |
| `bun` | `bunfig.toml` | error | (install.exact verified in bun 1.2.0) | [official docs](https://bun.com/docs/runtime/bunfig#install-exact) |
| `deno` | `deno.json` | error | (available since deno 1.30.0) | [official docs](https://docs.deno.com/runtime/reference/cli/add/) |
| `aube` | `.npmrc` | error | — | [official docs](https://aube.sh/settings/#setting-saveprefix) |

## `provenance` — warn

Provenance statements (via Sigstore) bind a published artifact to its recorded source and build.
Inspection scope: Explicit installation roots only (local settings).
Applies to: package.
For npm, package.json publishConfig.provenance overrides .npmrc, including false.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#11-generate-provenance-statements>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | (available since npm 9.5.0) | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#provenance) |
| `pnpm` | `.npmrc` | warn | — | [official docs](https://pnpm.io/cli/publish) |
| `yarn` | `.yarnrc.yml` | warn | — | [official docs](https://yarnpkg.com/configuration/yarnrc#npmPublishProvenance) |
| `bun` | `.npmrc` | warn | — | [official docs](https://github.com/oven-sh/bun/issues/15601) |

## `publish-access` — info

Set `publishConfig.access` so a misconfigured scope or registry never accidentally publishes an internal package publicly.
Inspection scope: Every discovered manifest.
Applies to: package.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#for-maintainers>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#access) |
| `pnpm` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |
| `yarn` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |
| `bun` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |
| `aube` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |

## `store-server` — info

Flag use of an external store server process, which introduces a trust boundary where tampered packages could be served.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://pnpm.io/settings/store#userunningstoreserver>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/settings/store#userunningstoreserver) |

## `strict-allow-scripts` — warn

Turn install-script policy warnings into hard errors so unapproved lifecycle scripts block installation.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://docs.npmjs.com/cli/v12/using-npm/config#strict-allow-scripts>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | — | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#strict-allow-scripts) |

## `strict-release-age` — info

Fail when no satisfying version meets the release age, instead of falling back to the lowest satisfying version.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | info | — | [official docs](https://aube.jdx.dev/settings/) |

## `strict-store-integrity` — warn

Refuse to import tarballs from the registry when the packument lacks a dist.integrity field, preventing silent integrity bypass.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/settings/) |

## `trust-policy` — warn

Fail installation when a package trust level has decreased compared to previous releases, catching publisher credential downgrades.
Inspection scope: Explicit installation roots only (local settings).
Upstream: <https://pnpm.io/settings/dependency-resolution#trustpolicy>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | warn | (available since pnpm 10.21.0) | [official docs](https://pnpm.io/settings/dependency-resolution#trustpolicy) |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/security.html) |

## `unsupported-settings` — error

Report configured settings introduced after the declared or explicit stable PM target version. Only the coverage table below is checked; unknown versions and unlisted settings are not assessed.
Inspection scope: Discovered manifests and explicit installation roots, using each directory's PM target.
Upstream: <https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | Repository | error | — | [upstream guide](https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error) |
| `pnpm` | Repository | error | — | [upstream guide](https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error) |
| `yarn` | Repository | error | — | [upstream guide](https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error) |
| `bun` | Repository | error | — | [upstream guide](https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error) |
| `deno` | Repository | error | — | [upstream guide](https://github.com/pHo9UBenaA/siro/blob/main/docs/rules.md#unsupported-settings--error) |

### Checked introduction versions

Only the following setting/file pairs are checked. This is not whole-schema validation or a guarantee of support in all later versions. Deno coverage is limited to `.npmrc#min-release-age`; Aube has no availability entries in this release.

| PM | File | Setting | First stable version in this file | Source |
| --- | --- | --- | --- | --- |
| npm | `.npmrc` | `provenance` | 9.5.0 | [release history](https://github.com/npm/cli/releases/tag/v9.5.0) |
| npm | `package.json` | `publishConfig.provenance` | 9.5.0 | [release history](https://github.com/npm/cli/releases/tag/v9.5.0) |
| npm | `.npmrc` | `min-release-age` | 11.10.0 | [release history](https://github.com/npm/cli/releases/tag/v11.10.0) |
| pnpm | `pnpm-workspace.yaml` | `strictDepBuilds` | 10.6.0 | [release history](https://github.com/pnpm/pnpm/releases/tag/v10.6.0) |
| pnpm | `pnpm-workspace.yaml` | `dangerouslyAllowAllBuilds` | 10.9.0 | [release history](https://github.com/pnpm/pnpm/releases/tag/v10.9.0) |
| pnpm | `pnpm-workspace.yaml` | `minimumReleaseAge` | 10.16.0 | [release history](https://github.com/pnpm/pnpm/releases/tag/v10.16.0) |
| pnpm | `pnpm-workspace.yaml` | `minimumReleaseAgeExclude` | 10.16.0 | [release history](https://github.com/pnpm/pnpm/releases/tag/v10.16.0) |
| pnpm | `pnpm-workspace.yaml` | `trustPolicy` | 10.21.0 | [release history](https://github.com/pnpm/pnpm/releases/tag/v10.21.0) |
| pnpm | `pnpm-workspace.yaml` | `blockExoticSubdeps` | 10.26.0 | [release history](https://github.com/pnpm/pnpm/releases/tag/v10.26.0) |
| pnpm | `pnpm-workspace.yaml` | `frozenStore` | 11.7.0 | [release history](https://github.com/pnpm/pnpm/releases/tag/v11.7.0) |
| yarn | `.yarnrc.yml` | `enableHardenedMode` | 4.0.0 | [release history](https://yarnpkg.com/blog/release/4.0) |
| yarn | `.yarnrc.yml` | `npmMinimalAgeGate` | 4.10.0 | [release history](https://github.com/yarnpkg/berry/releases/tag/@yarnpkg/cli/4.10.0) |
| yarn | `.yarnrc.yml` | `npmPreapprovedPackages` | 4.10.0 | [release history](https://github.com/yarnpkg/berry/releases/tag/@yarnpkg/cli/4.10.0) |
| bun | `bunfig.toml` | `install.minimumReleaseAge` | 1.3.0 | [release history](https://bun.com/blog/bun-v1.3#minimum-release-age) |
| bun | `bunfig.toml` | `install.security.scanner` | 1.2.21 | [release history](https://bun.com/blog/bun-v1.2.21#security-scanner-api-for-bun-install) |
| deno | `.npmrc` | `min-release-age` | 2.8.1 | [release history](https://github.com/denoland/deno/releases/tag/v2.8.1) |

For pnpm, strictDepBuilds was introduced in 10.3.0; the checked YAML location requires 10.6.0. A prerelease or range in packageManager leaves availability unknown. See [target versions](configuration.md#target-pm-versions) for explicit versions and precedence.

