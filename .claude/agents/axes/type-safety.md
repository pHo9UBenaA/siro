# Axis: type-safety

## What you are looking for

Type assertions (`as X`) in files where the oxlint `assertionStyle: "never"`
rule is overridden. Non-override files are static-gate territory — skip them.

## Scope

Read `.oxlintrc.json` overrides that relax `consistent-type-assertions` to
`"as"`. Expand the globs, grep for `as ` (excluding `as const`). Those files
are the search space. Also flag dead overrides (glob matches zero assertions).

## Remediation priority

1. **Eliminate** — fix the type signature so the assertion is unnecessary.
2. **Type guard** — only when elimination is impossible (e.g. upstream `any`).
3. **Keep as observation** — when neither works (e.g. branded-type minting).

A finding must name the concrete replacement. Proposing a guard when
elimination is viable → downgrade.

## Severity

- **P0**: Assertion masks a real type mismatch (reproducer required; prefer
  filing on `correctness` instead).
- **P1**: Eliminable assertion, or dead override in `.oxlintrc.json`.
- **P2**: Defensible today but fragile — almost always an observation.

## Out of scope

`as const` / `as const satisfies`. Bugs from wrong assertions → `correctness`.
Style preference when both paths are equally safe → drop.
