import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.private || process.env.GITHUB_REF_NAME !== `v${pkg.version}`) {
  throw new Error('Release tag must match the public package version.');
}
const ancestry = spawnSync(
  'git',
  ['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main'],
  {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  },
);
if (ancestry.error || ancestry.status !== 0)
  throw new Error(
    'Release commit must belong to fetched origin/main. Protect main and release tags separately.',
  );
console.log(pkg.version);
