# Threat model

siro checks local dependency-installation and publication configuration. Its output
helps review supported policy gaps; a clean result is not a security attestation.

## Trusted code and untrusted data

- PM manifests and configuration are read as data. Built-in checks do not install
  dependencies, execute package scripts or edit files. Automatically loaded
  `siro.config.json` supports data settings only, with no executable extensions
  or module references. It can still disable checks or narrow inspection scope.
- `.ts`, `.mjs`, and `.js` configuration is executable code. `--config <path>`
  explicitly opts into execution with the caller's permissions, before validating
  its exported value. Automatic discovery refuses executable config without running
  it. `--no-config` skips probing and loading repository configuration entirely.
  Custom rules and reporters have the same privileges and can alter results.
- Library `lint` calls do not import repository code. Executing a config through
  `loadConfig` requires an explicit `configPath`. Child and additional-root configs
  are not loaded automatically.
- Installing siro trusts its distributed code and dependencies. `npx` may download
  code before checking anything. Pin an exact version when repeatability matters.

For unfamiliar repositories, use `npx @pho9ubenaa/siro lint --no-config --strict-filesystem`
in an isolated environment without credentials and with restricted filesystem/network
access. These flags do not sandbox npm/npx or extensions. Do not execute repository
config in a privileged `pull_request_target` job.

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

Only selected, consumed inputs are parsed; this is not a whole-repository syntax audit.
See [configuration behavior](configuration.md#common-exclusions-and-filesystem-behavior)
for missing, empty and invalid inputs.

[Finite scan budgets](configuration.md#strict-filesystem-and-scan-budgets) bound
native file reads, directory enumeration, discovery, nesting, findings and output.
They do not impose a hard runtime or process-memory limit, prevent every parser CPU
attack, or confine trusted injected IO/config/extension code. Use process isolation
and CI timeouts as well.

## Using findings safely

Treat filenames, values and messages as untrusted data. Pretty output and CLI
diagnostics escape display controls; JSON preserves decoded values; GitHub output
escapes annotation fields. Parser diagnostics omit source excerpts, but observed
values, paths and extension messages are not secret-redacted. Consumers must encode
for their own output context and follow the [path contract](json-output.md#paths-and-remediation);
filenames are not necessarily portable across operating systems.

Remediation is advisory. Review edits, preserve unrelated content, resolve conflicts
and rerun lint. The word "automatic" describes an operation format, not permission
to write. siro does not apply those operations.

Read/parse errors mean inspection is incomplete. Output failures can leave a partial
report and exit `70`; do not turn them into a successful empty result. Trusted
extensions can bypass built-in reporting or start other work; output protection does
not sandbox them. See [JSON output](json-output.md) for consumer requirements.

## Release authority and impact

Publishing authority is restricted to a separate approval-controlled job. Successful
checks and provenance do not prove that a package is benign: compromised source or
build tooling can still produce malicious packages. Maintainers must configure the
[release controls](contributing.md#release-controls).

## Reporting vulnerabilities

See [SECURITY.md](../SECURITY.md) for private reporting and supported release policy.
