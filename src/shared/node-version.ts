import satisfies from 'semver/functions/satisfies.js';
import pkg from '../../package.json' with { type: 'json' };

export const SUPPORTED_NODE_RANGE = pkg.engines.node;

export const isSupportedNodeVersion = (version: string): boolean =>
  satisfies(version, SUPPORTED_NODE_RANGE);
