import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

it('runs the pnpm JavaScript entry with literal argv even when PATH only has an unusable cmd shim', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'siro-pnpm-launch-'));
  try {
    const bin = path.join(root, 'bin & spaces');
    mkdirSync(bin);
    const entry = path.join(bin, 'pnpm.cjs');
    writeFileSync(
      entry,
      `if(Object.keys(process.env).filter(key=>key.toLowerCase()==='npm_execpath').length!==1)process.exit(8);if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['audit','--json']))process.exit(9);console.log(JSON.stringify({metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0}},advisories:{}}));`,
    );
    writeFileSync(path.join(bin, 'pnpm.cmd'), '@exit /b 9\r\n');
    // Windows treats environment names case-insensitively, but the worker's
    // copied object does not. Remove every spelling before overriding a key.
    const inherited = { ...process.env, NPM_EXECPATH: path.join(root, 'wrong.cjs') };
    const env = Object.fromEntries(
      Object.entries(inherited).filter(
        ([key]) => !['path', 'npm_execpath'].includes(key.toLowerCase()),
      ),
    );
    const result = spawnSync(process.execPath, [path.resolve('scripts/security-audit.mjs')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...env, PATH: bin, npm_execpath: entry },
    });
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' });
    expect(result.stdout).toContain('No vulnerabilities found by pnpm audit');
    expect(result.stdout).toContain('OSV scan skipped');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
