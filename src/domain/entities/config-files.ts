import type { ConfigFileRef } from './rule.ts';
import { asRelPath } from '../../shared/paths.ts';

/** Known configuration locations and their parsers. */
export const CONFIG_FILES = {
  aubeWorkspace: { kind: 'yaml', path: asRelPath('aube-workspace.yaml') },
  bunfig: { kind: 'toml', path: asRelPath('bunfig.toml') },
  denoJson: { kind: 'json', path: asRelPath('deno.json') },
  npmrc: { kind: 'npmrc', path: asRelPath('.npmrc') },
  packageJson: { kind: 'json', path: asRelPath('package.json') },
  pnpmWorkspace: { kind: 'yaml', path: asRelPath('pnpm-workspace.yaml') },
  yarnrc: { kind: 'yaml', path: asRelPath('.yarnrc.yml') },
} as const satisfies Record<string, ConfigFileRef>;
