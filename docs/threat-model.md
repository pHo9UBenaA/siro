# Threat model

siro checks local dependency-installation and publication configuration. Its output
helps review supported policy gaps; a clean result is not a security attestation.

## Trusted code and untrusted data

- PM manifests and configuration are read as data. Built-in checks do not install
  dependencies, execute package scripts or edit files.
- `siro.config.ts`, `.mjs`, and `.js` are executable code. The CLI imports cwd's
  config automatically with the caller's permissions, before validating its exported
  value. `--no-config` disables probing and execution of that config entirely.
  Custom rules and reporters have the same privileges and can alter results.
- Library `lint` calls do not import repository code. `loadConfig` is an explicit
  opt-in to execution. Child and additional-root executable configs are not loaded.
- Installing siro trusts its distributed code and dependencies. `npx` may download
  code before checking anything. Pin an exact version when repeatability matters.

For unfamiliar repositories or pull requests, use `siro lint --no-config --strict-filesystem`
and an isolated environment without credentials and with restricted filesystem/network
access. The flags are not a sandbox and do not make npx's downloaded code untrusted-safe. Do not execute repository
config in a privileged `pull_request_target` job. Shape validation is not sandboxing.

## What a scan does not establish

siro does not detect malware, query vulnerability databases, validate every lockfile
resolution or enforce the commands used to install and publish. It does not resolve
user/global configuration, environment variables or inherited workspace policy.
An attacker who can change siro config or CI can disable checks; protect those files
through your repository's review and branch controls.

[Discovery](configuration.md#inspection-scope-packages-and-installation-roots) and
installation-policy inspection differ. Only explicit installation roots receive
installation checks; unlisted independent projects can remain uninspected. Rules may
also be disabled or downgraded. Exit `0` means no findings met the chosen threshold,
not that every input or control is safe.

PM versions are declarations, not measurements of installed binaries. Availability
checks cover only the [listed settings](rules.md#checked-introduction-versions).
See [policy sources](policy-sources.md) for manager-specific limits.

Directory symlinks below cwd are not traversed, but cwd and file symlinks use normal
filesystem resolution. A scan is neither a containment sandbox nor an atomic
filesystem snapshot. `--strict-filesystem` rejects detected symlink input paths;
ancestor replacement races and hard links remain outside its guarantee. Without it,
symlink targets can supply values that appear in findings, including external secrets.
Lockfile presence does not prove validity or git tracking.

Read/parse failures for selected, consumed inputs abort inspection. Optional missing
PM configuration becomes empty configuration; empty YAML/TOML/INI is allowed, not
empty JSON. Other PM files and disabled checks are not necessarily parsed.

[Finite scan budgets](configuration.md#strict-filesystem-and-scan-budgets) bound
native file reads, directory enumeration, discovery, nesting, findings and output.
They do not impose a hard runtime or process-memory limit, prevent every parser CPU
attack, or confine trusted injected IO/config/extension code. Use process isolation
and CI timeouts as well.

## Using findings safely

Treat filenames, values and messages as untrusted data. Pretty output and CLI
diagnostics escape display controls; JSON preserves decoded values; GitHub output
escapes annotation fields. API/JSON paths are cwd-relative; GitHub annotation files
are absolute, resolved against scan cwd. Parser syntax diagnostics omit source
excerpts, but observed values, paths and trusted extension messages are not secret
redaction. API consumers must encode for their own output context and must not assume
filenames are portable across operating systems.

Remediation is advisory. Review edits, preserve unrelated content, resolve conflicts
and rerun lint. The word "automatic" describes an operation format, not permission
to write. siro does not apply those operations.

Read/parse errors mean inspection is incomplete. Output failures can leave a partial
report and exit `70`; do not turn them into a successful empty result. Trusted
extensions can bypass built-in reporting or start other work; output protection does
not sandbox them. See [JSON output](json-output.md) for consumer requirements.

## Release authority and impact

Build/install/test/consumer verification run without OIDC authority. A separate,
environment-bound job stages the exact artifact after identity and digest checks;
it does not checkout code, install dependencies or rebuild. Tag/version and fetched
main ancestry checks do not prove authorization or benign bytes. Maintainers must
configure protected main/tags, environment approval and npm trusted publisher bindings;
see [release requirements](contributing.md#release-controls).

Treat code execution, release compromise, policy false-negatives, information disclosure
and availability attacks according to their demonstrated deployment impact, not rule
severity or test counts. These are potential threats, not a list of established
Critical/High vulnerabilities. Development tooling affecting releases is not low-impact
merely because it is not part of the runtime lint path.

## Reporting vulnerabilities

See [SECURITY.md](../SECURITY.md) for private reporting and supported release policy.
