#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const runCommand = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    code: result.status ?? -1,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  };
};

const parsePnpmAudit = (output) => {
  if (!output) return { summary: {}, findings: [] };

  let report;
  try {
    report = JSON.parse(output);
  } catch {
    return { parseError: true, summary: {}, findings: [] };
  }

  const metadata = report?.metadata?.vulnerabilities || {};
  const vulnerabilities = report?.vulnerabilities || {};

  const findings = Object.entries(vulnerabilities).flatMap(([name, details]) => {
    const list = Array.isArray(details.via) ? details.via : [];
    if (!list.length) {
      return [{ package: name, advisory: 'no structured advisory list' }];
    }

    return list.map((item) => {
      if (typeof item === 'string') {
        return { package: name, advisory: item };
      }
      return {
        package: name,
        advisory: item.title || item.url || item.range || 'unknown advisory',
      };
    });
  });

  return { summary: metadata, findings };
};

const parseOsv = (output) => {
  if (!output) return [];

  let json;
  try {
    json = JSON.parse(output);
  } catch {
    return null;
  }

  const entries = [];
  for (const item of json?.results ?? []) {
    for (const vuln of item.vulnerabilities ?? []) {
      entries.push({
        package: item.package?.name || item.package?.purl || 'unknown',
        version: item.package?.version || 'unknown',
        id: vuln.id || vuln.summary || 'unknown',
        details: vuln.summary || vuln.details || vuln.modified || 'unspecified',
      });
    }
  }

  return entries;
};

const runOsv = () => {
  let result = runCommand('pnpm', ['exec', 'osv-scanner', '--format', 'json', '--recursive', '.']);

  if (result.code === 127) {
    result = runCommand('npx', ['--yes', 'osv-scanner', '--format', 'json', '--recursive', '.']);
  }

  return result;
};

const pnpm = runCommand('pnpm', ['audit', '--json']);
const pnpmParse = parsePnpmAudit(pnpm.stdout);
const totalPnpm = Object.values(pnpmParse.summary || {}).reduce((acc, value) => acc + Number(value || 0), 0);

console.log('## pnpm audit');
if (pnpmParse.parseError) {
  console.log('Unable to parse pnpm audit JSON output.');
  if (pnpm.stderr) {
    console.log(pnpm.stderr);
  }
} else if (totalPnpm === 0 && pnpm.code === 0) {
  console.log('No vulnerabilities found by pnpm audit.');
} else {
  console.log(`found ${totalPnpm} vulnerability(s).`);
  for (const [level, count] of Object.entries(pnpmParse.summary ?? {})) {
    if (count) {
      console.log(`  - ${level}: ${count}`);
    }
  }
  for (const finding of pnpmParse.findings) {
    console.log(`  - ${finding.package}: ${finding.advisory}`);
  }
}

const osv = runOsv();
const osvFindings = parseOsv(osv.stdout);

console.log('');
console.log('## osv-scanner');
if (osv.code === 127 || osvFindings === null) {
  console.log('osv-scanner is unavailable. Run one of: pnpm dlx osv-scanner -- --format json --recursive . or npm i -g osv-scanner');
} else if (osv.code !== 0) {
  console.log(`osv-scanner command failed (code ${osv.code}).`);
  if (osv.stderr) {
    console.log(osv.stderr);
  }
} else if (!osvFindings.length) {
  console.log('No vulnerabilities found by osv-scanner.');
} else {
  console.log(`found ${osvFindings.length} issue(s).`);
  for (const finding of osvFindings) {
    console.log(`  - ${finding.package}@${finding.version}: ${finding.id} (${finding.details})`);
  }
}

const hasVuln = totalPnpm > 0 || (Array.isArray(osvFindings) && osvFindings.length > 0);
const commandFailed = pnpm.code !== 0 && !pnpmParse.parseError;
const toolUnavailable = osv.code === 127 || osvFindings === null;
process.exitCode = hasVuln || commandFailed ? 1 : 0;
if (toolUnavailable && !hasVuln) {
  console.log('');
  console.log('osv-scanner is optional; only pnpm audit findings are guaranteed by this script run.');
}
