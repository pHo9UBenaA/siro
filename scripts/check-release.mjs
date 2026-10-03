import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [artifact, ...extra] = process.argv.slice(2);
if (!artifact || extra.length) throw new Error('Usage: node scripts/check-release.mjs package.tgz');
const processOptions = { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 };
// Validate and hash the same bytes, even if the artifact file changes later.
const bytes = readFileSync(artifact);
const metadata = spawnSync('tar', ['-xOzf', '-', 'package/package.json'], {
  ...processOptions,
  input: bytes,
});
if (metadata.error || metadata.status !== 0)
  throw new Error('Cannot read packed package metadata.');
const parseMetadata = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid release package metadata.');
  }
};
const pkg = parseMetadata(metadata.stdout);
if (
  pkg?.name !== '@pho9ubenaa/siro' ||
  typeof pkg.version !== 'string' ||
  pkg.private ||
  process.env.GITHUB_REF_NAME !== `v${pkg.version}`
) {
  throw new Error('Packed package identity does not match the public release tag.');
}
const ancestry = spawnSync(
  'git',
  ['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main'],
  processOptions,
);
if (ancestry.error || ancestry.status !== 0)
  throw new Error(
    'Release commit must belong to fetched origin/main. Protect main and release tags separately.',
  );
console.log(createHash('sha256').update(bytes).digest('hex'));
