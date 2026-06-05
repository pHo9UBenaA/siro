import { chmodSync, writeFileSync } from 'node:fs';

const content = `#!/usr/bin/env node
import { run } from './cli.mjs';

const code = await run(process.argv.slice(2));
process.exitCode = code;
`;
const EXECUTABLE_MODE = 0o755;
writeFileSync('dist/cli.js', content);
chmodSync('dist/cli.js', EXECUTABLE_MODE);
