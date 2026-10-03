# Policy and sources

This page explains non-obvious findings and their upstream basis. For the full
list of checks, inputs and severities, see the [rule reference](rules.md).
[Configuration](configuration.md) defines which directories are inspected.

## Interpreting findings

Checks evaluate local settings, not the effective configuration of an installed
PM. A missing setting may receive lower severity only when its documented default
is safe across supported versions and environments. A declared version alone does
not establish an environment-dependent default.

`unsupported-settings` covers only the [listed introduction versions](rules.md#checked-introduction-versions).
It does not establish compatibility for unlisted settings, removals, backports or
version-specific values. A tagged source establishes behavior in that version;
introduction dates require release history. Aube's unversioned sources do not
establish per-setting introduction versions.

Any valid, active positive release-age window satisfies that check; three days is
a suggestion, not a guaranteed safe delay. Units differ: npm uses days, pnpm/Aube
minutes, Bun seconds, and Yarn numeric minutes or duration strings. Individual
package exclusions are not audited.

## npm

- `ignore-scripts` takes precedence over script approval policy.
- An explicit `before` in `.npmrc` takes precedence over `min-release-age`. A valid
  past cutoff satisfies the check. Future, disabled or malformed cutoffs require
  correction; setting a relative age alone does not repair the override. siro
  reports malformed dates even though npm discards them.
- `package.json#publishConfig.provenance` overrides local `.npmrc#provenance`,
  including false. The remedy targets the responsible file. CLI flags and environment
  overrides are outside this check, and this precedence is not assumed for other PMs.
- `publishConfig.access: "private"` is accepted as npm's alias of `"restricted"`.
- Known pre-12 targets may use `npm-shrinkwrap.json`; npm 12+ requires
  `package-lock.json`. Shrinkwrap-only projects with unknown targets are asked to
  declare their version or migrate. Presence does not establish lockfile validity.

Sources: [npm 12 configuration](https://github.com/npm/cli/blob/v12.0.2/workspaces/config/lib/definitions/definitions.js),
[publish options](https://github.com/npm/cli/blob/v12.0.2/lib/commands/publish.js#L313-L323),
[npm 11 shrinkwrap](https://github.com/npm/cli/blob/v11.16.0/docs/lib/content/configuring-npm/npm-shrinkwrap-json.md),
[npm 12 changes](https://github.com/npm/cli/releases/tag/v12.0.0).

## pnpm

- `ignoreScripts: true` satisfies the lifecycle check. Otherwise,
  `dangerouslyAllowAllBuilds` bypasses approval from pnpm 10.9. Before that version
  the bypass setting is ignored; remove it before upgrading.
- Although `strictDepBuilds` arrived in 10.3, using it in `pnpm-workspace.yaml`
  requires 10.6. The checked file location matters, not only the setting's name.
- Version- or CI-dependent defaults do not lower severity merely because a target
  version is declared. Set the checked controls explicitly to pin local policy.

Sources: [build settings](https://pnpm.io/settings/build),
[dependency resolution](https://pnpm.io/settings/dependency-resolution),
[store settings](https://pnpm.io/settings/store),
[10.3 configuration](https://github.com/pnpm/pnpm/blob/v10.3.0/config/config/src/index.ts),
[10.6 YAML support](https://github.com/pnpm/pnpm/releases/tag/v10.6.0),
[10.9 build bypass](https://github.com/pnpm/pnpm/releases/tag/v10.9.0).

## Yarn

CI lockfile immutability and public-PR hardened mode depend on the execution
environment. Their defaults are not treated as unconditional protection. Release
age accepts positive numeric minutes and Yarn duration strings, such as `3d`.

Sources: [Yarn configuration](https://yarnpkg.com/configuration/yarnrc),
[duration formats](https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/4.15.0/packages/yarnpkg-core/sources/miscUtils.ts),
[CI immutability](https://github.com/yarnpkg/berry/pull/2530),
[hardened mode](https://yarnpkg.com/blog/release/4.0).

## Bun

- An empty `trustedDependencies` list replaces Bun's curated default allowlist.
- `install.auto = false` and `"disable"` both satisfy the auto-install check.
- The provenance finding recommends publishing through npm; it does not claim that
  Bun emits attestations natively.
- The scanner API became available in 1.2.21, before the 1.3 overview. Release-age
  configuration requires 1.3.0.

Sources: [lifecycle scripts](https://bun.com/docs/pm/lifecycle),
[configuration](https://github.com/oven-sh/bun/blob/bun-v1.3.0/src/bunfig.zig),
[1.2.21 scanner release](https://bun.com/blog/bun-v1.2.21#security-scanner-api-for-bun-install),
[1.3 release age](https://bun.com/blog/bun-v1.3#minimum-release-age),
[provenance support](https://github.com/oven-sh/bun/issues/15601).

## Deno

- siro reads strict `deno.json`, not JSONC or external import maps. Exact pinning
  checks registry mappings in both inline `imports` and `scopes`, without resolving
  scope reachability. Blocking null mappings are not dependencies. Malformed
  consumed mappings fail inspection; dependency script opt-ins are not checked.
- An explicit `minimumDependencyAge` takes precedence over `.npmrc#min-release-age`.
  A valid object with absent/null `age` needs a positive local fallback; object
  shape alone is not protection. Zero fallback is an opt-out. Invalid or inactive
  explicit ages are not rescued by fallback.
- Deno accepts integral minutes, supported ISO durations and past date cutoffs.
  npmrc fallback uses integer days. In either form the age must produce a valid,
  representable past cutoff. Version-dependent defaults remain conservatively
  reported when no active local value is provided.
- Configured project-relative lockfile paths are honored; `lock: false` is flagged.

Sources: [Deno 2.9.4 configuration](https://github.com/denoland/deno/blob/v2.9.4/libs/config/deno_json/mod.rs),
[npmrc values](https://github.com/denoland/deno/blob/v2.9.4/libs/npmrc/lib.rs),
[duration formats](https://github.com/denoland/deno/blob/v2.9.4/libs/config/util.rs),
[2.8.1 fallback introduction](https://github.com/denoland/deno/releases/tag/v2.8.1),
[2.8.1 fallback behavior](https://github.com/denoland/deno/blob/v2.8.1/libs/resolver/factory.rs),
[2.9.4 defaults](https://github.com/denoland/deno/blob/v2.9.4/libs/resolver/factory.rs).

## Aube

- `jailBuilds` is checked in `aube-workspace.yaml`; `strictDepBuilds` in `.npmrc`.
- `paranoid` forces several security controls but does not override
  `verifyStoreIntegrity: false`. `advisoryCheck` and `trustPolicy` have safe current
  defaults. Other settings files and global overrides are outside this local check.
- Text `bun.lock` is supported; binary `bun.lockb` without a text replacement is
  rejected, and `deno.lock` is not reused.
- `preferFrozenLockfile` does not enforce immutability. The finding asks users to
  verify that install commands use `aube ci` or `--frozen-lockfile`.

Sources: [settings and accepted locations](https://github.com/aubepkg/aube/blob/main/crates/aube-settings/settings.toml),
[security behavior](https://github.com/aubepkg/aube/blob/main/docs/security.md),
[lockfile support](https://github.com/aubepkg/aube/blob/main/crates/aube-lockfile/src/io.rs).
