import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const cliArgs = process.argv.slice(2);
const output = cliArgs.length === 2 && cliArgs[0] === '--output' ? resolve(cliArgs[1]) : undefined;
assert.ok(
  cliArgs.length === 0 || (cliArgs.length === 1 && !cliArgs[0].startsWith('-')) || output,
  'Usage: pnpm test:package [package.tgz | --output package.tgz]',
);
let tarball = cliArgs.length === 1 ? resolve(cliArgs[0]) : undefined;
const consumer = mkdtempSync(join(tmpdir(), 'siro-consumer-'));

function run(command, args, cwd = consumer, status = 0) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: '', NODE_OPTIONS: '' },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${command} terminated by ${result.signal}`);
  assert.equal(
    result.status,
    status,
    `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout;
}

try {
  if (!tarball) {
    run('pnpm', ['pack', '--pack-destination', consumer], root);
    const archives = readdirSync(consumer).filter((file) => file.endsWith('.tgz'));
    assert.equal(archives.length, 1, 'Packing must produce exactly one tarball');
    tarball = join(consumer, archives[0]);
  }
  const files = run('tar', ['-tzf', tarball]).trim().split('\n');
  for (const file of files) {
    assert.match(
      file,
      /^package\/(?:package\.json|README\.md|LICENSE|CHANGELOG\.md|dist\/(?:cli\.js|index\.d\.mts|[\w-]+\.mjs))$/,
      `Unexpected package file: ${file}`,
    );
  }
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { [manifest.name]: `file:${tarball}` },
    }),
  );
  // A frozen repository install may not cache the resolution metadata needed
  // by a consumer without a lockfile. Fetch missing metadata instead of failing.
  run('pnpm', [
    'install',
    '--prefer-offline',
    '--ignore-scripts',
    '--config.manage-package-manager-versions=false',
  ]);
  const installed = JSON.parse(
    readFileSync(join(consumer, 'node_modules', manifest.name, 'package.json'), 'utf8'),
  );
  assert.equal(installed.name, manifest.name);
  assert.equal(installed.version, manifest.version);

  cpSync(join(root, 'test/package/consumer.mts'), join(consumer, 'consumer.mts'));
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: true,
        skipLibCheck: false,
        types: [],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
      },
      files: ['consumer.mts'],
    }),
  );
  run(process.execPath, [
    join(root, 'node_modules/typescript/bin/tsc'),
    '--project',
    'tsconfig.json',
  ]);
  run(process.execPath, ['consumer.mts']);

  // Use the installed executable link, including its shebang and package bin mapping.
  const cli = join(consumer, 'node_modules/.bin/siro');
  assert.equal(run(cli, ['--version']).trim(), manifest.version);
  cpSync(join(root, 'test/fixtures/npm-good'), join(consumer, 'good'), { recursive: true });
  cpSync(join(root, 'test/fixtures/npm-bad'), join(consumer, 'bad'), { recursive: true });
  const report = JSON.parse(run(cli, ['lint', 'good', '--json']));
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.siroVersion, manifest.version);
  const versionReport = JSON.parse(
    run(cli, ['lint', 'good', '--pm', 'npm', '--pm-version', '11.9.0', '--json'], consumer, 1),
  );
  assert.ok(versionReport.findings.some((finding) => finding.ruleId === 'unsupported-settings'));
  run(cli, ['lint', 'good', '--pm', 'npm', '--pm-version', '11.10.0']);
  run(cli, ['lint', 'good', '--pm-version', '11.10.0'], consumer, 2);
  run(cli, ['lint', 'bad'], consumer, 1);
  cpSync(join(root, 'test/fixtures/npm-good'), join(consumer, 'workspace'), { recursive: true });
  const workspaceManifest = JSON.parse(
    readFileSync(join(consumer, 'workspace/package.json'), 'utf8'),
  );
  writeFileSync(
    join(consumer, 'workspace/package.json'),
    JSON.stringify({ ...workspaceManifest, workspaces: ['child'] }),
  );
  mkdirSync(join(consumer, 'workspace/child'));
  writeFileSync(join(consumer, 'workspace/child/package.json'), '{"name":"child"}');
  writeFileSync(
    join(consumer, 'workspace/siro.config.mjs'),
    "export default { rules: { 'files-field': 'error' } };\n",
  );
  run(cli, ['lint', 'workspace']);
  const workspaceReport = JSON.parse(
    run(cli, ['lint', 'workspace', '--workspaces', '--json'], consumer, 1),
  );
  assert.ok(
    workspaceReport.findings.some(
      (finding) => finding.ruleId === 'files-field' && finding.file === 'child/package.json',
    ),
  );
  run(cli, ['--invalid-option'], consumer, 2);
  writeFileSync(
    join(consumer, 'good/siro.config.mjs'),
    "export default { reporters: [{ name: 'crash', format() { throw new Error('Package verification crash probe'); } }] };\n",
  );
  run(cli, ['lint', 'good', '--reporter', 'crash'], consumer, 70);
  // Retain the verified bytes for publication without packing a second time.
  if (output) copyFileSync(tarball, output);
  console.log(
    `Verified ${manifest.name}@${manifest.version}: ${files.length} public files, installed API, strict types, CLI exits 0/1/2/70.`,
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
