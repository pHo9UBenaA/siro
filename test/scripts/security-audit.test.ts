import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve(import.meta.dirname, '../../scripts/security-audit.mjs');
const cleanPnpm = {
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } },
  advisories: {},
};
const cleanOsv = { results: [] };
const vulnerableOsv = {
  results: [
    {
      source: { path: 'pnpm-lock.yaml', type: 'lockfile' },
      packages: [
        {
          package: { name: 'fixture-package', version: '1.2.3', ecosystem: 'npm' },
          vulnerabilities: [{ id: 'TEST-OSV-1', summary: 'Fixture vulnerability' }],
        },
      ],
    },
  ],
};

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr?: string;
  error?: { code: string; message: string };
  signal?: string;
}

const output = (report: unknown, status = 0): CommandResult => ({
  status,
  stdout: JSON.stringify(report),
});

// Execute the actual script while replacing only external commands. No scanners,
// registry requests, PATH-dependent executables, or package downloads run in tests.
const run = (pnpm = output(cleanPnpm), osv = output(cleanOsv)) => {
  const root = mkdtempSync(path.join(tmpdir(), 'siro-audit-test-'));
  try {
    writeFileSync(path.join(root, 'responses.json'), JSON.stringify({ pnpm, osv }));
    writeFileSync(path.join(root, 'commands.json'), '[]');
    const preload = path.join(root, 'preload.mjs');
    writeFileSync(
      preload,
      `
      import childProcess from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      import { readFileSync, writeFileSync } from 'node:fs';
      const responses = JSON.parse(readFileSync(new URL('./responses.json', import.meta.url)));
      const commands = [];
      childProcess.spawnSync = (command, args) => {
        commands.push([command, ...args]);
        writeFileSync(new URL('./commands.json', import.meta.url), JSON.stringify(commands));
        if (command === 'pnpm' && args[0] === 'audit') return responses.pnpm;
        if (command === 'osv-scanner' || (command === 'pnpm' && args[0] === 'exec')) return responses.osv;
        throw new Error('Unexpected external command: ' + command);
      };
      syncBuiltinESMExports();
    `,
    );
    const result = spawnSync(process.execPath, ['--import', preload, script], {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    });
    const commands: unknown = JSON.parse(readFileSync(path.join(root, 'commands.json'), 'utf8'));
    return { ...result, commands };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

it('reports both completed clean audits and runs the installed OSV scanner directly', () => {
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('No vulnerabilities found by pnpm audit.');
  expect(result.stdout).toContain('No vulnerabilities found by osv-scanner.');
  expect(result.commands).toEqual([
    ['pnpm', 'audit', '--json'],
    ['osv-scanner', 'scan', 'source', '--format', 'json', '--recursive', '.'],
  ]);
});

it('prints OSV package advisories and fails when OSV reports findings with exit 1', () => {
  const result = run(output(cleanPnpm), output(vulnerableOsv, 1));
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('fixture-package@1.2.3: TEST-OSV-1');
  expect(result.stdout).not.toContain('command failed');
});

it('fails on reported vulnerabilities even if OSV incorrectly exits 0', () => {
  expect(run(output(cleanPnpm), output(vulnerableOsv)).status).toBe(1);
});

it.each([
  { results: null },
  { results: [{ packages: [{ package: { name: 'clean-package', version: '1.0.0' } }] }] },
])('accepts OSV empty Go slices and omitted vulnerability lists: %j', (report) => {
  expect(run(output(cleanPnpm), output(report)).status).toBe(0);
});

it('prints pnpm 10 advisories and fails on findings', () => {
  const result = run(
    output(
      {
        metadata: { vulnerabilities: { ...cleanPnpm.metadata.vulnerabilities, high: 1 } },
        advisories: { '42': { module_name: 'fixture-package', title: 'Fixture vulnerability' } },
      },
      1,
    ),
  );
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('fixture-package: Fixture vulnerability');
});

it.each(['', 'not JSON', '{}', 'null', '{"metadata":{"vulnerabilities":{"high":"0"}}}'])(
  'fails on invalid pnpm output %j even when the command exits 0',
  (stdout) => {
    const result = run({ status: 0, stdout });
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('No vulnerabilities found by pnpm audit.');
  },
);

it('propagates pnpm failure when its output is not JSON', () => {
  const result = run({ status: 1, stdout: 'not JSON', stderr: 'registry unavailable' });
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('registry unavailable');
});

it('fails when the mandatory pnpm executable is missing', () => {
  expect(
    run({
      status: null,
      stdout: '',
      error: { code: 'ENOENT', message: 'pnpm missing' },
    }).status,
  ).toBe(2);
});

it.each(['', 'not JSON', '{}', '{"results":[{}]}'])('fails on invalid OSV output %j', (stdout) => {
  expect(run(output(cleanPnpm), { status: 0, stdout }).status).toBe(2);
});

it.each([1, 127, 128])(
  'fails on OSV exit %i without treating it as an absent executable',
  (status) => {
    const result = run(output(cleanPnpm), output(cleanOsv, status));
    expect(result.status).toBe(2);
    expect(result.stdout).not.toContain('No vulnerabilities found by osv-scanner.');
  },
);

it('explicitly skips only an absent optional OSV executable', () => {
  const result = run(output(cleanPnpm), {
    status: null,
    stdout: '',
    error: { code: 'ENOENT', message: 'not installed' },
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('OSV scan skipped');
  expect(result.stdout).not.toContain('No vulnerabilities found by osv-scanner.');
  expect(result.commands).toHaveLength(2);
});

it.each(['EACCES', 'ETIMEDOUT', 'ENOBUFS'])('fails on OSV spawn error %s', (code) => {
  expect(
    run(output(cleanPnpm), {
      status: null,
      stdout: '',
      error: { code, message: 'scanner failure' },
    }).status,
  ).toBe(2);
});

it('does not hide an audit failure behind findings from the other scanner', () => {
  expect(run({ status: 1, stdout: 'not JSON' }, output(vulnerableOsv, 1)).status).toBe(2);
});

it('fails when a scanner is terminated even after writing a clean report', () => {
  expect(
    run(output(cleanPnpm), {
      ...output(cleanOsv),
      status: null,
      signal: 'SIGTERM',
    }).status,
  ).toBe(2);
});
