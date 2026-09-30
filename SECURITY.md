# Security policy

## Reporting a vulnerability

Report a suspected vulnerability in siro through [GitHub private vulnerability reporting](https://github.com/pHo9UBenaA/siro/security/advisories/new), when available. Include the siro and Node versions, a minimal repository or configuration, reproduction steps, and the expected security impact. Remove credentials and private dependency names from examples.

If private reporting is unavailable, open an issue requesting a private contact channel without including exploit details or sensitive data. Ordinary incorrect findings and package-manager compatibility problems can be reported in [Issues](https://github.com/pHo9UBenaA/siro/issues).

Security fixes target the latest release; older release lines have no guaranteed backports. There is no guaranteed response time or support SLA.

## Scope

siro checks local package-manager configuration. A clean result is not proof that dependencies, installation scripts, or a repository are safe. Executable `siro.config.*` files and custom rules/reporters run with the invoking user's permissions. For unfamiliar checkouts, use `--no-config --strict-filesystem` in an isolated,
credential-free environment. Configuration is otherwise imported automatically;
shape validation and scan budgets do not sandbox executable code. Findings may
contain observed secrets; display escaping is not redaction.

See the [threat model](docs/threat-model.md) for trust boundaries, limitations, and release controls.
