# Configuration & behavior

## Versioning policy

`siro` is **version-agnostic by design**. The `packageManager` field is parsed for the manager
_name_ (e.g. `pnpm@10.9.0` → `pnpm`); the version segment is intentionally discarded, and `engines`
is never consulted. Every rule is written against the **latest stable major** of each manager, and
findings always describe what that latest version expects — not what a pinned older version might
get away with.

Why no version branching? Two reasons:

1. **One source of truth.** A rule with multiple version-conditional code paths quickly drifts
   from the manager's actual release history. Pinning the spec to "latest stable" keeps the
   surface area small and reviewable.
2. **Upgrades are part of hardening.** Most rules already require a setting that newer majors
   ship safely by default. Asking projects to upgrade is the same answer as asking them to pin
   the setting explicitly.

When a binding has authoritative version data, it surfaces it in the message as a parenthesised
suffix — `(available since pnpm 10.16.0; default safe since pnpm 11.0.0 (1440 minutes))` —
generated from a structured `versionNote`. The suffix is **display-only**; no severity or applicability check
reads it. See [version-matrix.md](version-matrix.md) for the per-rule × per-PM table that backs
these suffixes (and the cells still marked TBD pending upstream-docs research).

## Package manager detection

`siro` detects managers from these signals, strongest first:

1. The `packageManager` field in `package.json` (e.g. `pnpm@10.9.0`). The version segment is
   parsed off and discarded — see [versioning policy](#versioning-policy).
2. Lockfiles (`package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`,
   `bun.lock`, `bun.lockb`, `deno.lock`, `aube-lock.yaml`).
3. Manager config files (`.yarnrc.yml`, `bunfig.toml`, `pnpm-workspace.yaml`, `deno.json`,
   `aube-workspace.yaml`).

`.npmrc` is deliberately **not** a detection signal: npm, pnpm, and bun all read it, so its
presence identifies no single manager (every detection signal is owned by exactly one PM). An
npm repo is detected via `package-lock.json` / `npm-shrinkwrap.json` or the `packageManager`
field; with neither present, pass `--pm npm`.

`deno.jsonc` is **not supported**: detection and parsing target `deno.json` only (the JSON codec
reads strict JSON). On a `deno.jsonc`-only repo, deno is detected only via `deno.lock`,
and the deno rules see an absent config file. Migrate the config to `deno.json` before relying on the deno rules; JSONC
support is tracked as future work.

Multiple managers may be detected (monorepos, migrations); all are evaluated. Use `--pm <name>` to
force a single one. If nothing is detected, `lint` exits 2 — pass `--pm <name>` to
be explicit. (No silent fallback: linting a deno-only repo as `npm` would surface findings the user
can't act on.)

## Files inspected per package manager

Each rule binding declares one primary config file. The table below lists every file siro
reads for a given PM, with the number of rules that reference it.

| PM   | Config file           | Rules |
| ---- | --------------------- | ----: |
| npm  | `.npmrc`              |     7 |
| npm  | `package.json`        |     2 |
| npm  | lockfiles             |     1 |
| pnpm | `pnpm-workspace.yaml` |    11 |
| pnpm | `.npmrc`              |     1 |
| pnpm | `package.json`        |     2 |
| pnpm | lockfiles             |     1 |
| yarn | `.yarnrc.yml`         |    10 |
| yarn | `package.json`        |     2 |
| yarn | lockfiles             |     1 |
| bun  | `bunfig.toml`         |     6 |
| bun  | `.npmrc`              |     1 |
| bun  | `package.json`        |     3 |
| bun  | lockfiles             |     1 |
| deno | `deno.json`           |     4 |
| deno | lockfiles             |     1 |
| aube | `aube-workspace.yaml` |    10 |
| aube | `package.json`        |     2 |
| aube | lockfiles             |     1 |

"lockfiles" is always `commit-lockfile`, which checks for the PM's native lockfile(s) via
`ctx.exists()` — it does not parse file contents. `package.json` rules
(`files-field`, `publish-access`, and `disable-lifecycle-scripts × bun`'s
`trustedDependencies` fallback) read the typed valibot view from `ctx.packageJson`.

See [rules.md](rules.md) for per-rule target files and
[comparison.md](comparison.md) for the full rule × PM support matrix.

## `siro.config.ts`

Drop a `siro.config.{ts,mjs,js}` next to `package.json` to customize behavior:

```ts
import { defineConfig } from '@pho9ubenaa/siro';

export default defineConfig({
  pms: ['npm', 'pnpm'], // restrict detection to a subset
  rules: {
    provenance: 'off', // disable a rule
    'pin-exact-versions': 'warn', // override severity
  },
  customRules: [], // append project-specific rules
  reporters: [], // register custom Reporter implementations
});
```

`.ts` configs are loaded via Node's native type stripping (requires Node `^22.18.0 || ^23.6.0 || >=24`);
no extra build step. Only erasable TypeScript syntax is supported (no `enum`, `namespace`, or
parameter properties). On projects without `"type": "module"` in package.json, Node may print a
harmless `MODULE_TYPELESS_PACKAGE_JSON` notice on stderr.
Unknown rule IDs are caught at startup: siro exits with code 2 and prints
`siro.config: unknown rule id '…'` (or `unknown rule ids` for multiple) so typos fail fast.

## Per-PM severity and PM defaults

A rule's severity is its default; an individual PM binding can override it. Two mechanisms:

- **Static override** (`spec.severity`): a single PM is informational by design — e.g.
  `disable-lifecycle-scripts` × bun is `info` because Bun 1.3+ already blocks postinstall for
  untrusted packages outside the bunfig key.
- **`documentedDefault` advisory**: when the key is unset _and_ the PM's own documented
  default would satisfy the rule, the finding is emitted at `info` with the original message
  (plus the `versionNote` suffix when the binding declares one).
  Used today by:
  - `disable-lifecycle-scripts × yarn` (`enableScripts: false`).
  - `enforce-strict-ssl × npm` (`strict-ssl` defaults to `true`).
  - `checksum-verification × yarn` (`checksumBehavior` defaults to `'throw'`).
  - `block-exotic-subdeps × pnpm` (`blockExoticSubdeps` defaults to `true`),
    `× aube` (`blockExoticSubdeps` defaults to `true`).
  - `frozen-lockfile × pnpm` (`frozenLockfile: true`),
    `× yarn` (`enableImmutableInstalls: true`),
    `× aube` (`preferFrozenLockfile: true`).
  - `minimum-release-age × pnpm` (`minimumReleaseAge: 1440`),
    `× yarn` (`npmMinimalAgeGate: 1440`),
    `× aube` (`minimumReleaseAge: 1440`).
  - `hardened-mode × yarn` (`enableHardenedMode: true`, auto-enabled only for
    PRs on public repositories).
    The user is told "the PM default already covers you, but please
    pin it explicitly".
    Some documented defaults are conditional (pnpm's `frozenLockfile` and aube's
    `preferFrozenLockfile` auto-enable only under CI; yarn's `enableHardenedMode` only for
    PRs on public repositories); they still qualify for the advisory downgrade, and the
    binding's message names the condition.
    Reporters render these as ordinary `info` findings — they participate in
    `--severity info` thresholds and exit codes.

Bindings with `documentedDefault` accept an additional `defaultSatisfiedSeverity` field that
controls the severity of the advisory finding emitted when the key is unset and the PM default
already satisfies the rule. The default is `'info'` (educational notice, still surfaced by
reporters and `--severity info` thresholds). Setting `defaultSatisfiedSeverity: 'off'` makes
the silent case truly silent — no finding is produced when the key is unset and the PM default
covers the rule. Use the default (`'info'`) when you want to nudge users toward an explicit
pin even though they are safe today; use `'off'` when the CI noise is not worth it and you
trust the PM default to keep covering the case. Note that `'off'` removes the finding
entirely (the check reports ok): a user `rules` severity override re-levels findings but
does not resurrect a case `'off'` has silenced.

A user override (`rules: { 'rule-id': 'warn' }`) is the highest-priority signal and replaces
both static and `documentedDefault` overrides for that rule across every PM. Per-PM user
overrides (`'rule-id@pnpm'`) are not yet supported.

### Rules with multi-key logic

Four bindings ship hand-written check logic instead of the single-key `requireConfigKey` shape:

- `disable-lifecycle-scripts × pnpm` also checks `dangerouslyAllowAllBuilds`. If that bypass is
  `true` the rule reports a full-severity violation even when `strictDepBuilds: true` is also
  set — the combination is misleading. When neither key is set, the binding emits the finding
  at `info` (the hand-written equivalent of `documentedDefault`: pnpm 11+ gates dependency
  builds by default).
- `disable-lifecycle-scripts × bun` accepts **two equivalent opt-outs**:
  `install.ignoreScripts = true` in bunfig.toml _or_ `package.json#/trustedDependencies: []` —
  the check reads both, so either yields `ok`. The fix op targets only the bunfig key
  (builtin rules never emit a package.json setKey op).
- `enforce-strict-ssl × yarn` checks both `enableStrictSsl` and `unsafeHttpWhitelist` — if
  either `enableStrictSsl: false` or a non-empty `unsafeHttpWhitelist` list is present, the
  binding reports a violation. When `enableStrictSsl` is unset, the finding is emitted at `info`.
- `block-exotic-subdeps × npm` checks both `allow-git` and `allow-remote` in `.npmrc` — both
  must be set to `root` (or `none`) to satisfy the rule.

`hardened-mode` (Yarn 4) is a separate rule that requires `enableHardenedMode: true` in
`.yarnrc.yml`.

## Reporters

| Name               | Output                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `pretty` (default) | Colored, human-readable summary.                                       |
| `json`             | One JSON document containing `findings` and `summary`.                 |
| `github`           | GitHub Actions workflow commands (`::error`, `::warning`, `::notice`). |

Select with `--reporter <name>`. `--json` is a shortcut for `--reporter json`. Register additional
reporters via `siro.config.ts` (`reporters: [myReporter]`).

## Exit codes

| Code | Meaning                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | No findings at or above the active threshold.                                                                                                                      |
| `1`  | Findings at or above the threshold (default: `error`).                                                                                                             |
| `2`  | Usage error (unknown command/PM/severity, broken `siro.config.ts`, a filesystem errno error such as `EACCES`/`ENOTDIR`, or `lint` with no detectable PM).          |
| `70` | Uncaught exception — a siro bug or a throwing user extension (reporter / custom rule). Distinct from `1`/`2` so CI can tell a crash from findings or usage errors. |

## Dogfooding

This repository configures itself with the same recommendations: `save-exact` and `provenance`
in `.npmrc`, install-origin controls (`allow-git`, `allow-file`, `allow-remote`, `allow-directory`),
a committed lockfile, a `pnpm-workspace.yaml` with security settings (`frozenLockfile`,
`frozenStore`, `blockExoticSubdeps`, `strictDepBuilds`, `trustPolicy`, `minimumReleaseAge`),
and repo-local git hooks. See [contributing.md](contributing.md).
