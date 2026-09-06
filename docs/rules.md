<!-- AUTO-GENERATED from the rule registry. Run `pnpm gen:docs` to update. -->
# Rule reference

Each rule encodes one security intent and maps it per package manager. See the
[comparison matrix](comparison.md) for which PMs each rule applies to.
Bindings may read additional files through the rule context. Result-specific severity
and user overrides can change the default shown below. Version notes describe policy;
siro does not inspect the installed package-manager version. See [policy sources](policy-sources.md).

| Severity | Meaning |
| --- | --- |
| `error` | High-impact supply-chain risk. Fails `siro lint` by default. |
| `warn` | Strongly recommended hardening. Fails with `--severity warn`. |
| `info` | Good hygiene; advisory. |

## `advisory-check` — warn

Query the OSV database for known-malicious packages during dependency resolution.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/security.html) |

## `approved-git-repos` — warn

Restrict git: protocol dependencies to an explicit allowlist of approved repository URL patterns.
Upstream: <https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 4.14.0) | [official docs](https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories) |

## `audit-suppression` — info

Flag audit advisory suppressions that may silently hide future vulnerabilities via broad glob patterns.
Upstream: <https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | info | — | [official docs](https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories) |

## `block-auto-install` — warn

Disable auto-install so dependencies are only installed through an explicit install step where security guards apply.
Upstream: <https://bun.sh/docs/runtime/bunfig#install-auto>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `bun` | `bunfig.toml` | warn | — | [official docs](https://bun.sh/docs/runtime/bunfig#install-auto) |

## `block-exotic-subdeps` — warn

Refuse to install transitive dependencies sourced from git or tarball URLs, which bypass registry integrity checking.
Upstream: <https://pnpm.io/settings#blockexoticsubdeps>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | (default safe since npm 12.0.0) | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#allow-git) |
| `pnpm` | `pnpm-workspace.yaml` | warn | (available since pnpm 10.26.0; default safe since pnpm 10.26.0) | [official docs](https://pnpm.io/settings#blockexoticsubdeps) |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/security.html) |

## `bun-security-scanner` — info

Bun supports a Security Scanner API that intercepts new packages at install time (e.g. Socket Firewall).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#preinstall-scanners>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `bun` | `bunfig.toml` | info | (available since bun 1.3.0) | [official docs](https://bun.com/docs/pm/security-scanner-api) |

## `checksum-verification` — warn

Throw on checksum mismatches so tampered or corrupted packages are never silently installed.
Upstream: <https://yarnpkg.com/configuration/yarnrc#checksumBehavior>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | warn | — | [official docs](https://yarnpkg.com/configuration/yarnrc#checksumBehavior) |

## `commit-lockfile` — error

Lockfiles pin the full dependency tree and integrity hashes, enabling reproducible, verifiable installs (e.g. `npm ci`).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#2-include-lockfiles>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | Repository | error | — | [official docs](https://docs.npmjs.com/cli/v12/configuring-npm/package-lock-json) |
| `pnpm` | Repository | error | — | [official docs](https://pnpm.io/git#lockfiles) |
| `yarn` | Repository | error | — | [official docs](https://yarnpkg.com/getting-started/qa#should-lockfiles-be-committed-to-the-repository) |
| `bun` | Repository | error | — | [official docs](https://bun.com/docs/install/lockfile) |
| `deno` | `deno.json` | error | (available since deno 1.28.0) | [official docs](https://docs.deno.com/runtime/fundamentals/modules/#integrity-checking-and-lock-files) |
| `aube` | Repository | error | — | [official docs](https://github.com/aubepkg/aube/blob/main/docs/package-manager/lockfiles.md) |

## `dependency-overrides` — info

Flag dependency overrides that can replace transitive packages with arbitrary versions or forks — a supply-chain injection vector.
Upstream: <https://pnpm.io/settings#overrides>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/settings#overrides) |
| `aube` | `aube-workspace.yaml` | info | — | [official docs](https://aube.sh/settings/) |

## `disable-lifecycle-scripts` — error

Malicious postinstall scripts are a primary supply-chain attack vector. Prevent automatic execution of dependency lifecycle scripts.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#3-disable-lifecycle-scripts>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | error | — | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts) |
| `pnpm` | `pnpm-workspace.yaml` | error | (available since pnpm 10.3.0; default safe since pnpm 11.0.0) | [official docs](https://pnpm.io/settings#strictdepbuilds) |
| `yarn` | `.yarnrc.yml` | error | (available since yarn 2.0.0; default safe since yarn 4.14.0) | [official docs](https://yarnpkg.com/configuration/yarnrc#enableScripts) |
| `bun` | `bunfig.toml` | info | (available since bun 1.2.0) | [official docs](https://bun.com/docs/pm/lifecycle) |
| `aube` | `aube-workspace.yaml` | error | — | [official docs](https://aube.jdx.dev/security.html) |

## `enforce-strict-ssl` — warn

Require SSL certificate validation so registry traffic cannot be intercepted or tampered with.
Upstream: <https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | — | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl) |
| `yarn` | `.yarnrc.yml` | warn | — | [official docs](https://yarnpkg.com/configuration/yarnrc#enableStrictSsl) |

## `files-field` — info

An explicit `files` array in package.json restricts what gets published, preventing accidental inclusion of secrets or local files.
Applies to: package.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#11-review-published-files>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `pnpm` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `yarn` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `bun` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `deno` | `deno.json` | info | — | [official docs](https://docs.deno.com/runtime/reference/cli/publish/#how-publishing-works) |
| `aube` | `package.json` | info | — | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |

## `frozen-lockfile` — warn

Refuse to mutate the lockfile on install so unexpected dependency changes fail loudly.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#2-include-lockfiles>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | warn | — | [official docs](https://pnpm.io/settings#frozenlockfile) |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 2.0.0; default safe since yarn 3.0.0 in CI) | [official docs](https://yarnpkg.com/configuration/yarnrc#enableImmutableInstalls) |
| `bun` | `bunfig.toml` | warn | (available since bun 0.6.10) | [official docs](https://bun.com/docs/runtime/bunfig#install-frozenlockfile) |
| `deno` | `deno.json` | warn | — | [official docs](https://docs.deno.com/runtime/fundamentals/configuration/#lock) |
| `aube` | Repository | info | — | [official docs](https://github.com/aubepkg/aube/blob/main/docs/cli/ci.md) |

## `frozen-store` — info

Consider read-only store access for deployments whose dependencies are already present.
Upstream: <https://pnpm.io/settings/store#frozenstore>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | (available since pnpm 11.7.0) | [official docs](https://pnpm.io/settings/store#frozenstore) |

## `hardened-mode` — warn

Yarn 4's enableHardenedMode performs end-to-end checksum, lockfile, and version verification at install time.
Upstream: <https://yarnpkg.com/configuration/yarnrc#enableHardenedMode>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 4.0.0; default safe since yarn 4.0.0 (conditional: auto-enabled for PRs on public repositories)) | [official docs](https://yarnpkg.com/configuration/yarnrc#enableHardenedMode) |

## `minimum-release-age` — warn

Refuse to install releases newer than a cooldown window so freshly published (possibly compromised) versions are skipped.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#set-minimal-release-age>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | (min-release-age available since npm 11.10.0) | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#min-release-age) |
| `pnpm` | `pnpm-workspace.yaml` | warn | (available since pnpm 10.16.0; default safe since pnpm 11.0.0 (1440 minutes)) | [official docs](https://pnpm.io/settings#minimumreleaseage) |
| `yarn` | `.yarnrc.yml` | warn | (available since yarn 4.10.0; default safe since yarn 4.15.0 (1440 minutes)) | [official docs](https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate) |
| `bun` | `bunfig.toml` | warn | (available since bun 1.3.0) | [official docs](https://bun.com/docs/runtime/bunfig#install-minimumreleaseage) |
| `deno` | `deno.json` | warn | (default safe since deno 2.9.0 (1440 minutes); object age may be omitted) | [official docs](https://docs.deno.com/runtime/reference/deno_json/) |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.sh/settings/) |

## `named-registries` — info

Flag named registry mappings that redirect package resolution to custom registries, which may enable dependency confusion attacks.
Upstream: <https://pnpm.io/settings#namedregistries>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/settings#namedregistries) |

## `paranoid-mode` — info

Activate the strict-security setting bundle that forces trustPolicy, jailBuilds, minimumReleaseAgeStrict, strictStoreIntegrity, strictDepBuilds, and advisoryCheck on in one switch.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | info | — | [official docs](https://aube.jdx.dev/security.html) |

## `patched-dependencies` — info

Review local patches separately from the registry artifacts they modify.
Upstream: <https://pnpm.io/settings#patcheddependencies>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/settings#patcheddependencies) |

## `pin-exact-versions` — error

Semver ranges (^, ~) auto-adopt new releases, including compromised ones. Save exact versions by default.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#1-pin-dependency-versions>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | error | — | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#save-exact) |
| `pnpm` | `pnpm-workspace.yaml` | error | — | [official docs](https://pnpm.io/settings/other#saveprefix) |
| `yarn` | `.yarnrc.yml` | error | (available since yarn 2.0.0) | [official docs](https://yarnpkg.com/configuration/yarnrc#defaultSemverRangePrefix) |
| `bun` | `bunfig.toml` | error | (install.exact verified in bun 1.2.0) | [official docs](https://bun.com/docs/runtime/bunfig#install-exact) |
| `deno` | `deno.json` | error | (available since deno 1.30.0) | [official docs](https://docs.deno.com/runtime/reference/cli/add/) |
| `aube` | `.npmrc` | error | — | [official docs](https://aube.jdx.dev/settings/#saveprefix) |

## `provenance` — warn

Provenance statements (via Sigstore) bind a published artifact to its recorded source and build.
Applies to: package.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#10-generate-provenance-statements>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | (available since npm 9.5.0) | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#provenance) |
| `pnpm` | `.npmrc` | warn | — | [official docs](https://pnpm.io/cli/publish) |
| `yarn` | `.yarnrc.yml` | warn | — | [official docs](https://yarnpkg.com/configuration/yarnrc#npmPublishProvenance) |
| `bun` | `.npmrc` | warn | — | [official docs](https://github.com/oven-sh/bun/issues/15601) |

## `publish-access` — info

Set `publishConfig.access` so a misconfigured scope or registry never accidentally publishes an internal package publicly.
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
Upstream: <https://pnpm.io/settings#userunningStoreserver>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | info | — | [official docs](https://pnpm.io/settings#userunningStoreserver) |

## `strict-allow-scripts` — warn

Turn install-script policy warnings into hard errors so unapproved lifecycle scripts block installation.
Upstream: <https://docs.npmjs.com/cli/v12/using-npm/config#strict-allow-scripts>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `npm` | `.npmrc` | warn | — | [official docs](https://docs.npmjs.com/cli/v12/using-npm/config#strict-allow-scripts) |

## `strict-release-age` — info

Fail when no satisfying version meets the release age, instead of falling back to the lowest satisfying version.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | info | — | [official docs](https://aube.jdx.dev/settings/) |

## `strict-store-integrity` — warn

Refuse to import tarballs from the registry when the packument lacks a dist.integrity field, preventing silent integrity bypass.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/settings/) |

## `trust-policy` — warn

Fail installation when a package trust level has decreased compared to previous releases, catching publisher credential downgrades.
Upstream: <https://pnpm.io/settings#trustpolicy>

| PM | Primary input | Default severity | Version notes | Reference |
| --- | --- | --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | warn | (available since pnpm 10.21.0) | [official docs](https://pnpm.io/settings#trustpolicy) |
| `aube` | `aube-workspace.yaml` | warn | — | [official docs](https://aube.jdx.dev/security.html) |

