import type { ConfigFileRef } from './rule.ts';
import { asRelPath } from '../../shared/paths.ts';

/**
 * Canonical {@link ConfigFileRef}s for every package-manager config file siro
 * knows how to read. Centralizing them keeps each rule module from hardcoding
 * `kind` / `path` pairs, so renaming a file (or fixing a typo in its path) is a
 * single-line change. This is also the one place `RelPath` is minted for a
 * config ref — every downstream binding inherits the brand, so no rule needs
 * an ad-hoc `asRelPath(ref.path)` cast at the FS boundary.
 *
 * Add a new entry here when introducing support for a new package manager.
 */
export const CONFIG_FILES = {
  aubeWorkspace: { kind: 'yaml', path: asRelPath('aube-workspace.yaml') },
  bunfig: { kind: 'toml', path: asRelPath('bunfig.toml') },
  denoJson: { kind: 'json', path: asRelPath('deno.json') },
  npmrc: { kind: 'npmrc', path: asRelPath('.npmrc') },
  packageJson: { kind: 'json', path: asRelPath('package.json') },
  pnpmWorkspace: { kind: 'yaml', path: asRelPath('pnpm-workspace.yaml') },
  yarnrc: { kind: 'yaml', path: asRelPath('.yarnrc.yml') },
} as const satisfies Record<string, ConfigFileRef>;
