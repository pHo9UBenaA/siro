import satisfies from 'semver/functions/satisfies.js';
import { SUPPORTED_NODE_RANGE } from '../version.ts';

export { SUPPORTED_NODE_RANGE } from '../version.ts';

export const isSupportedNodeVersion = (version: string): boolean =>
  satisfies(version, SUPPORTED_NODE_RANGE);
