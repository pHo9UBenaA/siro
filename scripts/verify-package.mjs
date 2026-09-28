import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  closeSync,
  openSync,
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
import { pnpmCommand } from './pnpm-command.ts';

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
  if (command === 'pnpm') {
    ({ command, args } = pnpmCommand(args));
  }
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

// Keep shell execution out of the general runner: pnpm entries, tarball names
// and absolute paths must never become cmd.exe command text. Only this shim
// probe accepts fixed CLI tokens; it rejects shell metacharacters before launch.
function runCli(args, cwd = consumer, status = 0) {
  if (process.platform === 'win32') {
    assert.ok(args.every((arg) => /^[\w./-]+$/u.test(arg)));
    return run(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', `node_modules\\.bin\\siro.cmd ${args.join(' ')}`],
      cwd,
      status,
    );
  }
  return run(join(consumer, 'node_modules/.bin/siro'), args, cwd, status);
}

try {
  if (!tarball) {
    run('pnpm', ['pack', '--pack-destination', consumer], root);
    const archives = readdirSync(consumer).filter((file) => file.endsWith('.tgz'));
    assert.equal(archives.length, 1, 'Packing must produce exactly one tarball');
    tarball = join(consumer, archives[0]);
  }
  const files = run('tar', ['-tzf', tarball]).trim().split(/\r?\n/u);
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
  assert.equal(runCli(['--version']).trim(), manifest.version);
  cpSync(join(root, 'test/fixtures/npm-good'), join(consumer, 'good'), { recursive: true });
  cpSync(join(root, 'test/fixtures/npm-bad'), join(consumer, 'bad'), { recursive: true });
  const report = JSON.parse(runCli(['lint', 'good', '--json']));
  assert.equal(report.schemaVersion, 3);
  assert.equal(report.inspection.installationRoots[0].directory, '.');
  assert.equal(report.siroVersion, manifest.version);
  // Exercise the installed executable against an actual unwritable output fd.
  const outputFile = join(consumer, 'readonly-output');
  writeFileSync(outputFile, '');
  const readOnly = openSync(outputFile, 'r');
  try {
    const failedOutput = spawnSync(
      process.execPath,
      [join(consumer, 'node_modules', manifest.name, installed.bin.siro), 'lint', 'good', '--json'],
      { cwd: consumer, encoding: 'utf8', stdio: ['ignore', readOnly, 'pipe'], timeout: 10_000 },
    );
    assert.ifError(failedOutput.error);
    assert.equal(failedOutput.status, 70, failedOutput.stderr);
    assert.match(failedOutput.stderr, /Output failed/);
  } finally {
    closeSync(readOnly);
  }
  const versionReport = JSON.parse(
    runCli(['lint', 'good', '--pm', 'npm', '--pm-version', '11.9.0', '--json'], consumer, 1),
  );
  assert.ok(versionReport.findings.some((finding) => finding.ruleId === 'unsupported-settings'));
  runCli(['lint', 'good', '--pm', 'npm', '--pm-version', '11.10.0']);
  runCli(['lint', 'good', '--pm-version', '11.10.0'], consumer, 2);
  runCli(['lint', 'bad'], consumer, 1);
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
  runCli(['lint', 'workspace', '--exclude', 'child']);
  runCli(['lint', 'workspace', '--workspaces'], consumer, 2);
  const workspaceReport = JSON.parse(runCli(['lint', 'workspace', '--json'], consumer, 1));
  assert.ok(
    workspaceReport.findings.some(
      (finding) => finding.ruleId === 'files-field' && finding.file === 'child/package.json',
    ),
  );
  const installedScope = JSON.parse(
    runCli(
      ['lint', 'workspace', '--installation-root', '.', '--installation-root', 'child', '--json'],
      consumer,
      2,
    ) || 'null',
  );
  assert.equal(installedScope, null, 'Unknown child PM must fail without a success document');
  writeFileSync(
    join(consumer, 'workspace/child/package.json'),
    '{"name":"child","packageManager":"npm@12.0.2"}',
  );
  const expandedScope = JSON.parse(
    runCli(
      ['lint', 'workspace', '--installation-root', '.', '--installation-root', 'child', '--json'],
      consumer,
      1,
    ),
  );
  assert.equal(expandedScope.inspection.installationRoots.length, 2);
  runCli(['--invalid-option'], consumer, 2);
  writeFileSync(
    join(consumer, 'good/siro.config.mjs'),
    "export default { reporters: [{ name: 'crash', format() { throw new Error('Package verification crash probe'); } }] };\n",
  );
  runCli(['lint', 'good', '--reporter', 'crash'], consumer, 70);
  // Retain the verified bytes for publication without packing a second time.
  if (output) copyFileSync(tarball, output);
  console.log(
    `Verified ${manifest.name}@${manifest.version}: ${files.length} public files, installed API, strict types, CLI exits 0/1/2/70.`,
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
