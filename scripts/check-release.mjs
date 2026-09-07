import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.private || process.env.GITHUB_REF_NAME !== `v${pkg.version}`) {
  throw new Error('Release tag must match the public package version.');
}
