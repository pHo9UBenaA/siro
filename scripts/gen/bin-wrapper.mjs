import { chmodSync, writeFileSync } from 'node:fs';

const content = `#!/usr/bin/env node
import { runMain } from './cli.mjs';

await runMain(process.argv.slice(2));
`;
const EXECUTABLE_MODE = 0o755;
writeFileSync('dist/cli.js', content);
chmodSync('dist/cli.js', EXECUTABLE_MODE);
