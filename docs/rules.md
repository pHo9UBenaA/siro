<!-- AUTO-GENERATED from the rule registry. Run `pnpm gen:rules` to update. -->
# Rule reference

Each rule encodes one security intent and maps it per package manager. See the
[comparison matrix](comparison.md) for which PMs each rule applies to.

| Severity | Meaning |
| --- | --- |
| `error` | High-impact supply-chain risk. Fails `siro lint` by default. |
| `warn` | Strongly recommended hardening. Fails with `--severity warn`. |
| `info` | Good hygiene; advisory. |

## `advisory-check` — warn

Query the OSV database for known-malicious packages during dependency resolution.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Target | Reference |
| --- | --- | --- |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/security.html) |

## `approved-git-repos` — warn

Restrict git: protocol dependencies to an explicit allowlist of approved repository URL patterns.
Upstream: <https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories>

| PM | Target | Reference |
| --- | --- | --- |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories) |

## `audit-suppression` — info

Flag audit advisory suppressions that may silently hide future vulnerabilities via broad glob patterns.
Upstream: <https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories>

| PM | Target | Reference |
| --- | --- | --- |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#npmAuditIgnoreAdvisories) |

## `block-auto-install` — warn

Disable auto-install so dependencies are only installed through an explicit install step where security guards apply.
Upstream: <https://bun.sh/docs/runtime/bunfig#install-auto>

| PM | Target | Reference |
| --- | --- | --- |
| `bun` | `bunfig.toml` | [official docs](https://bun.sh/docs/runtime/bunfig#install-auto) |

## `block-exotic-subdeps` — warn

Refuse to install transitive dependencies sourced from git or tarball URLs, which bypass registry integrity checking.
Upstream: <https://pnpm.io/settings#blockexoticsubdeps>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `.npmrc` | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#allow-git) |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#blockexoticsubdeps) |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/security.html) |

## `bun-security-scanner` — info

Bun supports a Security Scanner API that intercepts new packages at install time (e.g. Socket Firewall).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#preinstall-scanners>

| PM | Target | Reference |
| --- | --- | --- |
| `bun` | `bunfig.toml` | [official docs](https://bun.com/docs/pm/security-scanner-api) |

## `checksum-verification` — warn

Throw on checksum mismatches so tampered or corrupted packages are never silently installed.
Upstream: <https://yarnpkg.com/configuration/yarnrc#checksumBehavior>

| PM | Target | Reference |
| --- | --- | --- |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#checksumBehavior) |

## `commit-lockfile` — error

Lockfiles pin the full dependency tree and integrity hashes, enabling reproducible, verifiable installs (e.g. `npm ci`).
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#2-include-lockfiles>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `package-lock.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json) |
| `pnpm` | `pnpm-lock.yaml` | [official docs](https://pnpm.io/git#lockfiles) |
| `yarn` | `yarn.lock` | [official docs](https://yarnpkg.com/getting-started/qa#should-lockfiles-be-committed-to-the-repository) |
| `bun` | `bun.lock` | [official docs](https://bun.com/docs/install/lockfile) |
| `deno` | `deno.lock` | [official docs](https://docs.deno.com/runtime/fundamentals/modules/#integrity-checking-and-lock-files) |
| `aube` | `aube-lock.yaml` | [official docs](https://aube.en.dev/package-manager/lockfiles) |

## `dependency-overrides` — info

Flag dependency overrides that can replace transitive packages with arbitrary versions or forks — a supply-chain injection vector.
Upstream: <https://pnpm.io/settings#overrides>

| PM | Target | Reference |
| --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#overrides) |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/settings.html) |

## `disable-lifecycle-scripts` — error

Malicious postinstall scripts are a primary supply-chain attack vector. Prevent automatic execution of dependency lifecycle scripts.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#3-disable-lifecycle-scripts>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `.npmrc` | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts) |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#strictdepbuilds) |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#enableScripts) |
| `bun` | `bunfig.toml` | [official docs](https://bun.com/docs/pm/lifecycle) |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/security.html) |

## `enforce-strict-ssl` — warn

Require SSL certificate validation so registry traffic cannot be intercepted or tampered with.
Upstream: <https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `.npmrc` | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl) |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#enableStrictSsl) |

## `files-field` — info

An explicit `files` array in package.json restricts what gets published, preventing accidental inclusion of secrets or local files.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#11-review-published-files>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `pnpm` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `yarn` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `bun` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |
| `deno` | `deno.json` | [official docs](https://docs.deno.com/runtime/reference/cli/publish/#how-publishing-works) |
| `aube` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files) |

## `frozen-lockfile` — warn

Refuse to mutate the lockfile on install so unexpected dependency changes fail loudly.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#2-include-lockfiles>

| PM | Target | Reference |
| --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#frozenlockfile) |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#enableImmutableInstalls) |
| `bun` | `bunfig.toml` | [official docs](https://bun.com/docs/runtime/bunfig#install-frozenlockfile) |
| `deno` | `deno.json` | [official docs](https://docs.deno.com/runtime/fundamentals/configuration/#lock) |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.en.dev/settings/) |

## `frozen-store` — info

Recommend enabling frozenStore to prevent mutations to the content-addressable store, strengthening supply-chain integrity in CI and deploy environments.
Upstream: <https://pnpm.io/settings#frozenstore>

| PM | Target | Reference |
| --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#frozenstore) |

## `hardened-mode` — warn

Yarn 4's enableHardenedMode performs end-to-end checksum, lockfile, and version verification at install time.
Upstream: <https://yarnpkg.com/configuration/yarnrc#enableHardenedMode>

| PM | Target | Reference |
| --- | --- | --- |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#enableHardenedMode) |

## `minimum-release-age` — warn

Refuse to install releases newer than a cooldown window so freshly published (possibly compromised) versions are skipped.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#set-minimal-release-age>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `.npmrc` | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age) |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#minimumreleaseage) |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate) |
| `bun` | `bunfig.toml` | [official docs](https://bun.com/docs/runtime/bunfig#install-minimumreleaseage) |
| `deno` | `deno.json` | [official docs](https://docs.deno.com/runtime/reference/deno_json/) |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.en.dev/settings/) |

## `named-registries` — info

Flag named registry mappings that redirect package resolution to custom registries, which may enable dependency confusion attacks.
Upstream: <https://pnpm.io/settings#namedregistries>

| PM | Target | Reference |
| --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#namedregistries) |

## `paranoid-mode` — info

Activate the strict-security setting bundle that forces trustPolicy, jailBuilds, minimumReleaseAgeStrict, strictStoreIntegrity, strictDepBuilds, and advisoryCheck on in one switch.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Target | Reference |
| --- | --- | --- |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/security.html) |

## `patched-dependencies` — info

Flag patched dependencies whose source code is modified by local patch files, bypassing registry integrity verification.
Upstream: <https://pnpm.io/settings#patcheddependencies>

| PM | Target | Reference |
| --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#patcheddependencies) |

## `pin-exact-versions` — error

Semver ranges (^, ~) auto-adopt new releases, including compromised ones. Save exact versions by default.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#1-pin-dependency-versions>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `.npmrc` | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#save-exact) |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#saveprefix) |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#defaultSemverRangePrefix) |
| `bun` | `bunfig.toml` | [official docs](https://bun.com/docs/runtime/bunfig#install-exact) |
| `deno` | `deno.json` | [official docs](https://docs.deno.com/runtime/reference/cli/add/) |

## `provenance` — warn

Provenance statements (via Sigstore) tie a release to its source and build, letting consumers verify it was not tampered with.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#10-generate-provenance-statements>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `.npmrc` | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#provenance) |
| `pnpm` | `.npmrc` | [official docs](https://pnpm.io/cli/publish) |
| `yarn` | `.yarnrc.yml` | [official docs](https://yarnpkg.com/configuration/yarnrc#npmPublishProvenance) |
| `bun` | `.npmrc` | [official docs](https://github.com/oven-sh/bun/issues/15601) |

## `publish-access` — info

Set `publishConfig.access` so a misconfigured scope or registry never accidentally publishes an internal package publicly.
Upstream: <https://github.com/bodadotsh/npm-security-best-practices#for-maintainers>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |
| `pnpm` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |
| `yarn` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |
| `bun` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |
| `aube` | `package.json` | [official docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig) |

## `store-server` — info

Flag use of an external store server process, which introduces a trust boundary where tampered packages could be served.
Upstream: <https://pnpm.io/settings#userunningStoreserver>

| PM | Target | Reference |
| --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#userunningStoreserver) |

## `strict-allow-scripts` — warn

Turn install-script policy warnings into hard errors so unapproved lifecycle scripts block installation.
Upstream: <https://docs.npmjs.com/cli/v11/using-npm/config#strict-allow-scripts>

| PM | Target | Reference |
| --- | --- | --- |
| `npm` | `.npmrc` | [official docs](https://docs.npmjs.com/cli/v11/using-npm/config#strict-allow-scripts) |

## `strict-release-age` — info

Make the minimum release age gate a hard failure instead of falling back to the next-oldest satisfying version.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Target | Reference |
| --- | --- | --- |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/settings/) |

## `strict-store-integrity` — warn

Refuse to import tarballs from the registry when the packument lacks a dist.integrity field, preventing silent integrity bypass.
Upstream: <https://aube.jdx.dev/security.html>

| PM | Target | Reference |
| --- | --- | --- |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/settings/) |

## `trust-policy` — warn

Fail installation when a package trust level has decreased compared to previous releases, catching publisher credential downgrades.
Upstream: <https://pnpm.io/settings#trustpolicy>

| PM | Target | Reference |
| --- | --- | --- |
| `pnpm` | `pnpm-workspace.yaml` | [official docs](https://pnpm.io/settings#trustpolicy) |
| `aube` | `aube-workspace.yaml` | [official docs](https://aube.jdx.dev/security.html) |

