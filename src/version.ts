import pkg from '../package.json' with { type: 'json' };

export const version = pkg.version;

export const SUPPORTED_NODE_RANGE = pkg.engines.node;
