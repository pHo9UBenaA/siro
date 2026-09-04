# OSS Benchmarks

Real-world config validation benchmarks using leading OSS projects.

## What the results establish

These selected repositories and saved snapshots exercise package-manager detection and configuration compatibility. They are not a representative sample of the ecosystem, independently labeled security ground truth, or evidence that those repositories use siro.

Counts from this harness must not be presented as vulnerability prevalence, precision/recall, security ratings, or market adoption. A security-posture study would additionally need pinned repository revisions, applicable-rule denominators, effective defaults and overrides, and manual false-positive review. Snapshot dates and missing configuration must remain visible.

## Setup (sparse clones)

Coverage checks require locally cloned repos. The clone script uses
`git sparse-checkout` to download only the specific config files needed
per project—not the entire repository.

The cloned repos live under `oss-benchmarks/repos/<owner>/<name>/` and are
**git-ignored** — they are never committed to this repository.

### Convenience script

```bash
./oss-benchmarks/clone.sh            # clone all
./oss-benchmarks/clone.sh --dry-run  # preview only
```

## Usage

Check coverage using the saved snapshot (no clone needed after first snapshot):

```bash
pnpm check:oss-coverage
```

Check coverage directly from local clones (skips projects not cloned):

```bash
node oss-benchmarks/check.mjs --local
```

Rebuild the snapshot from local clones:

```bash
node oss-benchmarks/check.mjs --update
```
