# Per-rule × per-PM version matrix

`siro` is [version-agnostic](configuration.md#versioning-policy): it never branches on the
caller's package-manager version. This table is the **display-only** source of truth for the
`(available since …; default safe since …)` suffixes attached to lint messages, and the working
checklist for the upstream-docs research still in flight.

Conventions:

- **Available since** — first PM version that shipped the config key under its current name.
- **Default safe since** — first PM version whose built-in default already satisfies the rule
  (i.e. the version that justifies `documentedDefault` downgrading the finding to `info`).
- **TBD** — not yet verified against official changelogs/release notes. Do **not** quote a TBD
  cell in `versionNote` text; leave the suffix off until the cell is confirmed.
- **n/a** — the rule does not apply to that PM (no equivalent setting), or the PM does not ship
  the key as a built-in default.
- Cell sources should be official docs / release notes. Community blog posts are not acceptable
  as the primary citation.

> Last verified: 2026-06-06. Bolded cells are confirmed against upstream changelogs/release
> notes/source-at-tag on this date; unbolded "TBD" cells remain pending follow-up research.
> Aube does not annotate per-key version history in its official docs or release notes
> (releases v1.13.0–v1.18.0 reviewed), so aube-specific cells stay "TBD (no versioned changelog
> found)" until upstream publishes a per-key history.

## `disable-lifecycle-scripts`

| PM   | Key                                      | Available since                                                                                                                                                    | Default safe since                                                                                                                                                                                       | Notes                                                                                                                                                                                               |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm  | `ignore-scripts` (.npmrc)                | predates available changelog (very old; documented in npm v1+) ([docs](https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts))                            | n/a (no safe default)                                                                                                                                                                                    | Always opt-in.                                                                                                                                                                                      |
| pnpm | `strictDepBuilds` (pnpm-workspace.yaml)  | **pnpm 10.3.0** ([release](https://github.com/pnpm/pnpm/releases/tag/v10.3.0))                                                                                     | **pnpm 11.0.0** ([release](https://github.com/pnpm/pnpm/releases/tag/v11.0.0))                                                                                                                           | Bypass key `dangerouslyAllowAllBuilds` short-circuits the gate (available since **pnpm 10.9.0** — [release](https://github.com/pnpm/pnpm/releases/tag/v10.9.0)).                                    |
| yarn | `enableScripts` (.yarnrc.yml)            | **yarn 2.0.0** ([Configuration.ts @ 2.0.0-rc.36](https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/2.0.0-rc.36/packages/yarnpkg-core/sources/Configuration.ts)) | **yarn 4.14.0** — default flipped from `true` to `false` via PR [#7089](https://github.com/yarnpkg/berry/pull/7089) ([release](https://github.com/yarnpkg/berry/releases/tag/%40yarnpkg%2Fcli%2F4.14.0)) | yarn 2.0–4.13.x ran scripts by default; only ≥4.14.0 ships the safe default.                                                                                                                        |
| bun  | `install.ignoreScripts` (bunfig.toml)    | **bun 1.2.0** ([PR #16541](https://github.com/oven-sh/bun/pull/16541))                                                                                             | n/a (key not safe-by-default; opts out of the allow-list)                                                                                                                                                | The `trustedDependencies` curated-allow-list semantics shipped earlier in bun 1.1 ([blog](https://bun.com/blog/bun-v1.1)); the bunfig key honouring `install.ignoreScripts` itself landed in 1.2.0. |
| aube | `jailBuilds` (aube-workspace.yaml)       | TBD (no versioned changelog found)                                                                                                                                 | n/a (defaults `false`; planned to flip next major) ([docs](https://aube.en.dev/package-manager/configuration.html))                                                                                      | Aube-specific. Linux Landlock/seccomp enforcement landed in [aube v1.4.0](https://github.com/endevco/aube/releases/tag/v1.4.0), but the key itself predates that release.                           |
| deno | n/a — deno does not run install scripts. |                                                                                                                                                                    |                                                                                                                                                                                                          |                                                                                                                                                                                                     |

## `frozen-lockfile`

| PM   | Key                                          | Available since                                                                                                                                       | Default safe since                                                                                                                   | Notes                                                                                                                |
| ---- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| npm  | n/a — use `npm ci` (no config-key binding)   | n/a                                                                                                                                                   | n/a                                                                                                                                  | npm's `ci` command implies frozen behaviour; .npmrc has no equivalent toggle, so siro emits no binding for npm here. |
| pnpm | `frozenLockfile` (pnpm-workspace.yaml)       | TBD (predates pnpm 10.x changelog window; no release-note origin found)                                                                               | TBD (`--frozen-lockfile` is auto-true under CI per [docs](https://pnpm.io/cli/install#--frozen-lockfile))                            | pnpm auto-enables it under CI.                                                                                       |
| yarn | `enableImmutableInstalls` (.yarnrc.yml)      | **yarn 2.0.0** ([source @ 2.0.0-rc.36](https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/2.0.0-rc.36/packages/plugin-essentials/sources/index.ts)) | **yarn 3.0.0** — default switched to `isCI` (PR [#2530](https://github.com/yarnpkg/berry/pull/2530))                                 | yarn auto-enables under CI from 3.0 onward.                                                                          |
| bun  | `install.frozenLockfile` (bunfig.toml)       | **bun 0.6.10** ([PR #3365](https://github.com/oven-sh/bun/pull/3365))                                                                                 | TBD                                                                                                                                  | Bun docs use camelCase; `install.frozen` is not honoured.                                                            |
| aube | `preferFrozenLockfile` (aube-workspace.yaml) | TBD (no versioned changelog found)                                                                                                                    | TBD (aube defaults to `Prefer` outside CI and `Frozen` inside CI per [docs](https://aube.en.dev/package-manager/configuration.html)) | aube auto-flips to frozen under CI.                                                                                  |
| deno | `--frozen-lockfile` CLI flag                 | **deno 1.45.0** ([release](https://github.com/denoland/deno/releases/tag/v1.45.0))                                                                    | n/a                                                                                                                                  | `--frozen` alias `--frozen-lockfile`. Configuration-file form `lock.frozen` in `deno.json` not yet researched.       |

## `minimum-release-age`

| PM   | Key                                       | Available since                                                                                                                 | Default safe since                                                                                                                                                          | Notes                                                                                  |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| npm  | `min-release-age` (.npmrc)                | **npm 11.10.0** ([release](https://github.com/npm/cli/releases/tag/v11.10.0), [PR #8965](https://github.com/npm/cli/pull/8965)) | n/a                                                                                                                                                                         | Days unit.                                                                             |
| pnpm | `minimumReleaseAge` (pnpm-workspace.yaml) | **pnpm 10.16.0** ([release](https://github.com/pnpm/pnpm/releases/tag/v10.16.0))                                                | **pnpm 11.0.0** (1440 minutes) ([release](https://github.com/pnpm/pnpm/releases/tag/v11.0.0))                                                                               | Minutes unit; 24h default is shorter than siro's 3-day recommendation.                 |
| yarn | `npmMinimalAgeGate` (.yarnrc.yml)         | **yarn 4.10.0** ([release](https://github.com/yarnpkg/berry/releases/tag/%40yarnpkg%2Fcli%2F4.10.0))                            | **yarn 4.15.0** (1440 minutes) ([release](https://github.com/yarnpkg/berry/releases/tag/%40yarnpkg%2Fcli%2F4.15.0), PR [#7135](https://github.com/yarnpkg/berry/pull/7135)) | Minutes unit (yarn `DurationUnit.MINUTES`; default literal `'1d'` → 1440).             |
| bun  | `install.minimumReleaseAge` (bunfig.toml) | **bun 1.3.0** ([PR #22801](https://github.com/oven-sh/bun/pull/22801), [blog](https://bun.com/blog/bun-v1.3))                   | n/a                                                                                                                                                                         | Seconds unit.                                                                          |
| aube | `minimumReleaseAge` (aube-workspace.yaml) | TBD (no versioned changelog found)                                                                                              | **1440 minutes by default** ([docs](https://aube.en.dev/package-manager/configuration.html))                                                                                | Minutes unit; mirrors pnpm 11's default. Set to `0` to disable.                        |
| deno | `minimumDependencyAge` (deno.json)        | TBD (introduced in Deno 2.x) ([docs](https://docs.deno.com/runtime/reference/deno_json/))                                       | n/a (not set by default)                                                                                                                                                    | ISO-8601 duration string (e.g. `"P3D"`), minutes number, or object `{ age, exclude }`. |

## `pin-exact-versions`

| PM   | Key(s)                                                                                                                             | Available since                                                                                                                                       | Default safe since | Notes                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| npm  | `save-exact=true`, `save-prefix=` (.npmrc)                                                                                         | predates available changelog (very old; design predates npm v1 per [npm/rfcs#509](https://github.com/npm/rfcs/issues/509))                            | n/a                | Two-key combo; both required.                                                                                               |
| pnpm | `savePrefix: ''` (pnpm-workspace.yaml)                                                                                             | TBD (legacy setting; no release-note origin found in indexed changelog)                                                                               | n/a (default `^`)  | pnpm's built-in default is `'^'`, which the rule rejects.                                                                   |
| yarn | `defaultSemverRangePrefix: ''` (.yarnrc.yml)                                                                                       | **yarn 2.0.0** ([source @ 2.0.0-rc.36](https://github.com/yarnpkg/berry/blob/%40yarnpkg/cli/2.0.0-rc.36/packages/plugin-essentials/sources/index.ts)) | n/a (default `^`)  | Renamed during PRs [#561](https://github.com/yarnpkg/berry/pull/561) / [#1665](https://github.com/yarnpkg/berry/pull/1665). |
| bun  | `install.exact = true` (bunfig.toml)                                                                                               | **bun 0.6.10** (confirmed in `src/bunfig.zig` at the tag)                                                                                             | n/a                |                                                                                                                             |
| aube | n/a — binding removed 2026-06-12 (`savePrefix` not present in official configuration docs; re-add when upstream documents the key) | n/a                                                                                                                                                   | n/a                | Previously inherited from pnpm without an upstream counterpart.                                                             |
| deno | `imports` exactness in deno.json                                                                                                   | **deno 1.30.0** (inline `imports` in `deno.json`) ([blog](https://deno.com/blog/v1.30))                                                               | n/a                | Lint-time check over `imports`. `deno.json` auto-discovery itself dates to [deno 1.18](https://deno.com/blog/v1.18).        |

## `commit-lockfile`

| PM   | File                  | Available since                                                                             | Default safe since | Notes                                                                                                        |
| ---- | --------------------- | ------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| npm  | `package-lock.json`   | predates available changelog                                                                | n/a                |                                                                                                              |
| pnpm | `pnpm-lock.yaml`      | predates available changelog                                                                | n/a                |                                                                                                              |
| yarn | `yarn.lock`           | predates available changelog                                                                | n/a                |                                                                                                              |
| bun  | `bun.lock`            | bun 1.x (`bun.lockb` is the earlier binary form)                                            | n/a                | Earlier bun shipped `bun.lockb`; the secondary form still counts.                                            |
| deno | `deno.lock`           | **deno 1.28.0** (auto-discovered next to `deno.json`) ([blog](https://deno.com/blog/v1.28)) | n/a                | Lockfile API existed since deno 1.0 via `--lock`; auto-creation as `deno.lock` next to `deno.json` is 1.28+. |
| aube | shared lockfile shape | n/a                                                                                         | n/a                | aube reuses whatever lockfile already exists.                                                                |

## `provenance`

| PM   | Key                                                      | Available since                                                                    | Default safe since | Notes                                    |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------ | ---------------------------------------- |
| npm  | `provenance=true` (.npmrc / publishConfig)               | **npm 9.5.0** ([release](https://github.com/npm/cli/releases/tag/v9.5.0))          | n/a                | Requires OIDC-capable CI.                |
| pnpm | `provenance=true` (.npmrc shared)                        | mirrors npm — pnpm reads `.npmrc` (npm 9.5.0 baseline applies)                     | n/a                | Mirrors npm.                             |
| yarn | `npmPublishProvenance` (.yarnrc.yml)                     | TBD                                                                                | n/a                | Yarn-side toggle for the same OIDC flow. |
| bun  | `bun publish --provenance` not native                    | n/a (tracked via [oven-sh/bun#15601](https://github.com/oven-sh/bun/issues/15601)) | n/a                |                                          |
| deno | n/a — publishes via JSR, different model.                |                                                                                    |                    |                                          |
| aube | n/a — no upstream attestation pipeline yet (no binding). |                                                                                    |                    |                                          |

## `publish-access`

| PM   | Key                      | Available since                                                                                                                | Default safe since | Notes                                            |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------ |
| npm  | `access=public` (.npmrc) | predates available changelog (tied to scoped-packages launch — [docs](https://docs.npmjs.com/cli/v11/using-npm/config#access)) | n/a                | Scoped packages default to restricted otherwise. |
| pnpm | inherits npm             | mirrors npm                                                                                                                    | n/a                |                                                  |

## `files-field`

| PM                | Field                  | Available since | Default safe since | Notes                  |
| ----------------- | ---------------------- | --------------- | ------------------ | ---------------------- |
| npm/pnpm/yarn/bun | `files` (package.json) | always          | n/a                | Same field across PMs. |

## `bun-security-scanner`

| PM  | Key                                      | Available since                                                                                               | Default safe since | Notes                  |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------- |
| bun | `install.security.scanner` (bunfig.toml) | **bun 1.3.0** ([PR #21183](https://github.com/oven-sh/bun/pull/21183), [blog](https://bun.com/blog/bun-v1.3)) | n/a                | Pluggable scanner API. |

## `hardened-mode`

| PM   | Key                                | Available since                                                                                                       | Default safe since                                                                | Notes                                                                                                                                                 |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| yarn | `enableHardenedMode` (.yarnrc.yml) | **yarn 4.0.0** (first stable yarn release containing the key; PR [#4307](https://github.com/yarnpkg/berry/pull/4307)) | **yarn 4.0.0** — conditional: auto-enabled only when `isPR && isPublicRepository` | End-to-end checksum/lockfile/version verification at install. The conditional default justifies the binding's `documentedDefault` advisory downgrade. |

## `block-exotic-subdeps`

| PM   | Key                                        | Available since                                                                                                  | Default safe since                                                                                         | Notes                                                                                                    |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| npm  | `allow-git`, `allow-remote` (.npmrc)       | TBD (npm 11.x; no release-note origin found) ([docs](https://docs.npmjs.com/cli/v11/using-npm/config#allow-git)) | n/a (default `all`)                                                                                        | Two-key combo; both must be `root` or `none`. `root` = only root project may use exotic sources.         |
| pnpm | `blockExoticSubdeps` (pnpm-workspace.yaml) | **pnpm 10.26.0** ([release](https://github.com/pnpm/pnpm/releases/tag/v10.26.0))                                 | **pnpm 10.26.0** — default `true` since introduction ([docs](https://pnpm.io/settings#blockexoticsubdeps)) | Only direct dependencies may use git repos or tarball URLs; transitive deps must come from the registry. |

## `trust-policy`

| PM   | Key                                 | Available since                                                                  | Default safe since  | Notes                                                                                         |
| ---- | ----------------------------------- | -------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| pnpm | `trustPolicy` (pnpm-workspace.yaml) | **pnpm 10.21.0** ([release](https://github.com/pnpm/pnpm/releases/tag/v10.21.0)) | n/a (default `off`) | Fails installation when a package trust level has decreased. Set to `no-downgrade` to enable. |

## Maintenance

When updating a cell:

1. Read the official changelog / release notes for the version that introduced the change.
2. Update both the table cell and (if the rule's `versionNote` quotes the version) the matching
   `versionNote` literal in `src/domain/rules/*.ts`.
3. Add the source URL inline as a footnote-style link if the change is non-obvious.
4. Update the "Last verified" line at the top of this file.
5. **Migration debt to clear when verifying a TBD cell:** the bindings listed below still
   hand-write "<PM> defaults <key> to <value>" in their `message` body because the matrix's
   "Default safe since" cell is TBD. When you verify the cell, also migrate the body to
   `versionNote.defaultSafeSince` and reword the body to start with `Set ...`:
   - `frozen-lockfile × pnpm` (`frozenLockfile`) — TBD for both columns
   - `frozen-lockfile × aube` (`preferFrozenLockfile`) — TBD for both columns

## Known open items

- **aube `savePrefix`** — resolved 2026-06-12 by removing the `pin-exact-versions × aube`
  binding: the key is not visible in the official aube configuration docs (last checked
  2026-06-06). Re-add the binding (and restore the matrix row) when upstream documents it.
- **deno `lock.frozen`** — the `frozen-lockfile × deno` rule recommends `lock.frozen: true` in
  `deno.json`, but the introduction version of the _config-file form_ (as opposed to the
  `--frozen-lockfile` CLI flag, which is **deno 1.45.0**) has not been verified.
- **`commit-lockfile` and `pin-exact-versions × deno` advisory bindings** — both use
  `AdvisoryRuleBinding` directly per PM, so their messages don't pass through
  `renderVersionNoteMessage` yet. The deno-side cells (`deno.lock` since 1.28.0, inline
  `imports` in `deno.json` since 1.30.0) are the most concrete candidates for a future
  builder-side `versionNote` extension; until that lands, the matrix entry is the only place
  those versions are surfaced.
- **deno `minimumDependencyAge`** — the exact Deno version that introduced the `deno.json`
  config-file form has not been verified (the CLI `--minimum-dependency-age` flag may predate it).
