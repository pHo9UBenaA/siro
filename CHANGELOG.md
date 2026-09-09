# Changelog

## [0.5.0]

### Features

- Add `unsupported-settings` to report configured settings introduced after a declared or explicit stable PM version. Cover 15 setting/file pairs across npm, pnpm, Yarn, and Bun, with a generated table of release sources.
- Resolve each manager's target from `package.json#packageManager`, `config.pmVersions`, or the higher-priority `--pm-version` / API `pmVersion` option (which requires `--pm` / `pm`). Expose the resolved target as `RuleContext.pmVersion` for custom rules.
- Preserve name detection when a declaration has no exact stable version. Reject ranges, tags, partial versions, and prereleases in explicit targets; accept build metadata such as Corepack hashes.
- Add opt-in `--workspaces` / API `workspaces: true` to inspect declared npm, pnpm, Yarn, and Bun members' publication metadata. Reuse existing rules, identify member file paths, and aggregate severity counts and CLI exit status.
- Add optional `FileSystem.readDirectories` for workspace discovery in virtual repositories, without falling back to host IO.

### Behavior and scope

- The new rule defaults to `error`; projects with previously accepted unsupported settings may now exit 1. Existing security checks, severity overrides, and JSON schema 2 remain in effect.
- Availability checks cover recorded introductions in the listed files, not whole PM schemas, runtime discovery, removals, backports, version-specific value syntax, or effective defaults. Deno and Aube retain their existing checks without introduction coverage in this release.
- Distinguish pnpm's strict-build setting introduction (10.3.0) from general workspace YAML support (10.6.0), and correct Bun's scanner introduction note to 1.2.21.
- Keep shared installation and lockfile checks at the root. Members infer their own publication status and use the root's PM target; child executable configs are not loaded. Workspace discovery requires explicit declarations, excludes directory symlinks, and does not yet cover Deno/Aube or effective configuration inheritance.

### Fixes

- Report rejected workspace glob patterns as configuration errors (exit 2) instead of internal crashes (exit 70).
- Reject non-file manifest inputs before reading, preventing root and workspace FIFO manifests from blocking the scan.
- Match literal workspace path segments and exclusions case-insensitively on macOS and Windows, so declaration casing does not silently omit members.
- Use minimatch consistently for workspace membership, exclusions, and traversal. Remove custom brace expansion and globstar matching.
- Limit workspace traversal using each applicable pattern's own depth, preserving errors from required directory reads.
- Wait for asynchronous reporters and propagate their failures through the command's error handling.
- Reject non-file entries at configuration and lockfile paths instead of accepting directories as existing files.

### Verification

- Exercise version boundaries, selection precedence, multi-manager isolation, invalid targets, CLI exit codes, custom-rule context, and the installed package's API and strict types.
- Exercise workspace patterns, exclusions, duplicate matches, malformed child manifests, private roots with public children, injected IO, and installed CLI/API member inspection.

## [0.4.3]

### Maintenance

- Verify the packed package from an isolated consumer on both supported Node majors in CI. Check distributed files, installed CLI exit codes, package exports, custom rules, JSON output, and strict TypeScript declaration resolution without development dependency types.
- Verify the same tarball before staging it for npm publication, preferring cached dependencies with install scripts disabled.
- Centralize packing, verification, and temporary-file cleanup in `pnpm test:package`; retain the verified artifact on request for publication.
- Move the release tag/version check into a standalone script while preserving the rejection of private packages and mismatched tags before installation and publication.
- Allow bounded startup headroom for audit subprocess tests on shared runners and report process failures before reading their output records.

## [0.4.2]

### Fixes

- Correct the development dependency audit script to read pnpm advisories and OSV's nested package findings. Fail on malformed reports, command errors, and incomplete scans; preserve vulnerability exit status and advisory details.
- Use an installed official OSV-Scanner binary and explicitly report its absence. Remove automatic scanner downloads and bound command execution and output size.

### Maintenance

- Run main-branch CI on pull requests to avoid duplicate checks after merges. Publication still runs full verification for version tags.
- Set the pnpm minimum release age and Dependabot Action-update cooldown to seven days, and align the threat model with those settings.

## [0.4.1]

### Maintenance

- Update development dependencies to address known CVEs and remove deprecated `git-raw-commits`. Upgrade Knip and replace its local low-memory patch with upstream support.

- Update pinned GitHub Actions to checkout 7.0.1, setup-node 7.0.0, and pnpm/action-setup 6.0.10 after the three-day release-age window. Explicitly disable automatic Node package-manager caching in the publication job.
- Set Dependabot version-update cooldown to three days, matching pnpm's minimum release age.

## [0.4.0]

### Breaking Changes

- **One remediation per check**: replace binding `fix`/`fixKind` and finding `fix`/`fixable`/`manualSteps` with automatic operations or manual instructions in `remediation`. JSON output uses schema 2.
- **Explicit library configuration**: `lint` evaluates without executing repository configuration. Pass extensions inside `config`; use `loadConfig` to opt into trusted code execution. `LintCommandOptions` adds reporting to `LintOptions`.
- **Validated extension boundaries**: parsed values and `getByPath()` results are `unknown`. Rules, bindings, reporters, and configuration maps require ordinary or null-prototype objects. Path constructors reject invalid roots and parent traversal.
- **Simpler bindings and exports**: remove `fileGlob`, separate automatic/advisory binding types, `requireConfigKey.extraFix`, `KeyAssignment`, and internal implementation exports. `RuleContext.readConfig` shares parsed inputs across checks; a violation can identify an additional input file.

### Fixes

- Keep version- and environment-dependent defaults at the configured severity until their conditions can be established.
- Align npm 12 script-policy precedence, URL restrictions, release-age values, and lockfile guidance with the cited upstream policy.
- Read Aube `strictDepBuilds` from `.npmrc`, combine it with workspace `jailBuilds`, and report and propose changes in the correct files. Correct advisory/trust defaults, paranoid overrides, and supported lockfiles.
- Honor pnpm `ignoreScripts` and Bun's boolean auto-install disable. Keep store, provenance, and frozen-install guidance within what configuration alone establishes.
- Correct npm/Aube exact-save precedence and Deno registry import checks, including tags, missing versions, partial versions, and subpaths.
- Match supported Deno and Yarn release-age formats; reject malformed ages and exclusions while preserving valid exclusions in remediation.
- Honor Deno's configured lockfile path and flag disabled or malformed lock settings. Report unsupported `deno.jsonc` explicitly.
- Reject invalid consumed manifest fields, non-mapping JSON/YAML roots, empty JSON, invalid extension results, and inaccessible or non-directory targets with actionable errors.
- Preserve severity overrides for prototype-named rules and compute exit decisions before custom reporters run. Require manual review when remediation would overwrite a settings container or leave a security bypass active.
- Validate repeated, missing, unknown, and non-boolean CLI options consistently. Match Node support against the package engine range.
- Limit the declared Node.js support range to the maintained majors exercised by CI.
- Reject cyclic YAML aliases and excessive alias expansion without repeatedly traversing unused nested anchors.

### Refactoring

- Consolidate CLI parsing on Node's argument tokenizer and remove the direct `cac` dependency. Keep configuration validation and parsed-file caching at their input boundaries.
- Replace custom script loaders, rule scaffolding, layer restrictions, and selective hook machinery with native Node scripts and direct verification commands.
- Generate rule inputs, default severities, and version notes from live bindings. Replace the duplicated version matrix with concise policy sources and interpretation limits.
- Remove private OSS research from the public repository and replace the single-package dependency catalog with exact versions in `package.json`.
- Build before every test command so executable CLI and public API cases cannot silently skip. Run full verification in CI and before release staging; require the tag to match the package version and stage exactly one packed artifact.

### Security and documentation

- Pin GitHub Actions to full commit SHAs, disable persisted checkout credentials, and configure Dependabot updates.
- Add security reporting guidance, a threat model, and a concrete configuration example. Clarify executable configuration, static-analysis limits, migration, and package verification.

## [0.3.0]

### Features

- **Project policy selection**: `--project-type application|package`, `SiroConfig.projectType`, and `LintOptions.projectType` distinguish dependency-consuming applications from published packages. Omit the selection to infer policy per package-manager binding.
- **Scoped custom rules**: `Rule.projectTypes` follows explicit or inferred policy for npm-family and Deno bindings.

### Fixes

- Programmatic `lintCommand` calls reject unsupported project type, package manager, and severity values instead of returning misleading results.
- Malformed custom rules from config files or untyped programmatic callers are rejected before rule merging and evaluation.
- Empty and whitespace-only package names no longer activate published-package policy.
- Unscoped Deno rules no longer read `deno.json` solely for project-type inference.
- The published `package.json#bin` preserves exit code 70 when a reporter or custom rule crashes, and subprocess tests now execute that declared bin directly.
- Malformed or cyclic YAML configurations are rejected, while TOML configurations with a leading UTF-8 BOM are accepted.
- Deno release-age validation accepts documented default forms and rejects invalid, partial, or zero ages.
- Repeated reporter selectors and non-boolean Yarn strict SSL values are rejected as invalid input.
- Findings without automatic remediation operations no longer report themselves as fixable.

## [0.2.0]

### Breaking Changes

- **Node.js `^22.18.0 || ^23.6.0 || >=24.0.0` required** (was `>=20`): `siro.config.ts` now loads via Node's native type stripping.

### Features

- **OSS benchmarks module**: coverage validation against 47 leading OSS projects across all 6 package managers. Includes sparse-checkout clone script, snapshot-based CI mode, and local clone-based checking.
- **jiti dependency removed**: runtime dependencies drop from 7 to 6. `.ts` configs load via native type stripping, and every `loadConfig` call now truly re-reads the config from disk (jiti's transform cache could replay a same-second rewrite).
- **Unminified dist**: the published bundle ships as readable JavaScript for supply-chain transparency.

### Fixes

- A `.ts` config on a runtime without type stripping fails with an actionable `ConfigError` instead of a raw `ERR_UNKNOWN_FILE_EXTENSION`.
- `pnpm gen:rule` works again — the scaffolder's marker had drifted from `rule-id.ts`.

## [0.1.3]

Initial public release. 27 rules across 6 package managers (npm, pnpm, yarn, bun, deno, aube).

### Features

- **27 security rules** covering lifecycle scripts, version pinning, lockfiles (`commit`/`frozen`), release age, publish provenance, `files`/`publishConfig`, SSL enforcement, checksum verification, exotic subdependency blocking, audit suppression review, store integrity, and Bun's security scanner API.
- **6 package managers**: npm, pnpm, yarn, bun, deno, aube — auto-detected from `packageManager` field, lockfiles, and config files.
- **PM-aware severities**: findings demoted to `info` when the PM's documented default already satisfies the rule.
- **Machine-readable JSON output** with `fix` operations and `manualSteps` for automated remediation.
- **Reporters**: `pretty` (default), `json` (CI), `github` (PR annotations); extensible via custom reporters.
- **Configuration file** (`siro.config.ts`): disable rules, override severities, restrict PMs, plug in custom rules and reporters.
- **`--severity` flag**: gate CI on `error` (default) or `warn` for stricter checks.
- **`--pm` flag**: target a specific package manager.
- **`--json` flag**: shortcut for `--reporter json`.

Earlier implementations remain available in the release tags. See the [rule reference](docs/rules.md) for current policies.

### Tooling

- CI via GitHub Actions (Node 20, 22, 24 matrix)
- Pre-commit hooks: lint (oxlint), format (oxfmt), typecheck, related tests
- Pre-push hooks: full lint, typecheck, test coverage
- Commit message linting via commitlint (conventional commits)
- Dead code detection via knip
- Rule scaffold generator (`pnpm gen:rule`)
- Documentation generators (`pnpm gen:rules`, `pnpm gen:comparison`)
- Version module auto-generation from package.json
- Layering enforcement script
