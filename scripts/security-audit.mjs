#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import * as vb from 'valibot';

const count = vb.pipe(vb.number(), vb.safeInteger(), vb.minValue(0));
// pnpm 10 uses advisories, not npm's vulnerabilities[].via representation.
const pnpmReport = vb.object({
  metadata: vb.object({
    vulnerabilities: vb.object({
      info: count,
      low: count,
      moderate: count,
      high: count,
      critical: count,
    }),
  }),
  advisories: vb.record(vb.string(), vb.object({ module_name: vb.string(), title: vb.string() })),
});
// https://google.github.io/osv-scanner/output/#json
// Go slices can serialize as null; vulnerabilities are omitted for clean packages.
const osvReport = vb.object({
  results: vb.nullable(
    vb.array(
      vb.object({
        packages: vb.nullable(
          vb.array(
            vb.object({
              package: vb.object({ name: vb.string(), version: vb.string() }),
              vulnerabilities: vb.optional(
                vb.array(
                  vb.object({
                    id: vb.string(),
                    summary: vb.optional(vb.string()),
                  }),
                ),
                [],
              ),
            }),
          ),
        ),
      }),
    ),
  ),
});

const parsePnpm = (value) => {
  const report = vb.parse(pnpmReport, value);
  const total = Object.values(report.metadata.vulnerabilities).reduce(
    (sum, severityCount) => sum + severityCount,
    0,
  );
  const lines = Object.values(report.advisories).map(
    (item) => `${item.module_name}: ${item.title}`,
  );
  return { total: Math.max(total, lines.length), lines };
};

const parseOsv = (value) => {
  const report = vb.parse(osvReport, value);
  const lines = (report.results ?? []).flatMap((source) =>
    (source.packages ?? []).flatMap((item) =>
      item.vulnerabilities.map(
        (vuln) =>
          `${item.package.name}@${item.package.version}: ${vuln.id}${vuln.summary ? ` (${vuln.summary})` : ''}`,
      ),
    ),
  );
  return { total: lines.length, lines };
};

// Exit 0: completed clean checks; 1: findings; 2: incomplete/invalid audit.
// Only ENOENT for the optional OSV executable is a skip, never a successful scan.
const audit = (label, command, args, parse, optional = false) => {
  console.log(`## ${label}`);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (optional && result.error?.code === 'ENOENT') {
    console.log('OSV scan skipped: osv-scanner is not installed; only pnpm audit was run.');
    console.log('Install the official binary: https://google.github.io/osv-scanner/installation/');
    return 0;
  }
  try {
    if (result.error) throw new Error(result.error.message);
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`command failed (code ${result.status}, signal ${result.signal ?? 'none'}).`);
    }
    const report = parse(JSON.parse(result.stdout));
    if (report.total > 0) {
      console.log(`found ${report.total} vulnerability(s).`);
      for (const line of report.lines) console.log(`  - ${line}`);
      return 1;
    }
    if (result.status !== 0) throw new Error('command exited 1 without recognized findings.');
    console.log(`No vulnerabilities found by ${label}.`);
    return 0;
  } catch (error) {
    console.error(`${label}: audit failed: ${error.message}`);
    if (result.stderr?.trim()) console.error(result.stderr.trim());
    return 2;
  }
};

const pnpmStatus = audit('pnpm audit', 'pnpm', ['audit', '--json'], parsePnpm);
console.log('');
const osvStatus = audit(
  'osv-scanner',
  'osv-scanner',
  ['scan', 'source', '--format', 'json', '--recursive', '.'],
  parseOsv,
  true,
);
process.exitCode = Math.max(pnpmStatus, osvStatus);
