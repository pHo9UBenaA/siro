import assert from 'node:assert';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';

vi.setConfig({ testTimeout: 5000 });

const MISSING: undefined = JSON.parse('{}')._;

const CTX = path.join(import.meta.dirname, '..', '..', 'scripts', 'review', 'ctx.mjs');

const EXIT_SUCCESS = 0;
const EXIT_NOT_FOUND = 1;
const EXIT_USAGE = 2;
const CLEAN_RUN_COUNT_ONE = 1;

const run = (args: string[], opts?: { stdin?: string }): SpawnSyncReturns<string> => {
  let input = '';
  if (opts) {
    input = opts.stdin ?? '';
  }
  return spawnSync(process.execPath, [CTX, ...args], {
    encoding: 'utf8',
    input,
  });
};

describe('usage', () => {
  it('prints USAGE to stderr and exits 2 with no args', () => {
    expect.hasAssertions();
    const result = run([]);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('review-ctx:');
    expect(result.stderr).toContain('ledger slugs');
  });
});

describe('ledger slugs — rejected', () => {
  it('returns JSON entries for --kind rejected', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'slugs', '--kind', 'rejected']);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entries: { id: string; oneline: string; slug: string }[] = JSON.parse(result.stdout);
    expect(entries.length).toBeGreaterThan(EXIT_SUCCESS);
    expect(entries[EXIT_SUCCESS]).toHaveProperty('id');
    expect(entries[EXIT_SUCCESS]).toHaveProperty('slug');
    expect(entries[EXIT_SUCCESS]).toHaveProperty('oneline');
    const first = entries[EXIT_SUCCESS];
    assert(first, 'expected at least one entry');
    expect(first.id).toMatch(/^R\d+$/u);
  });
});

describe('ledger slugs — decisions', () => {
  it('returns JSON entries for --kind decisions', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'slugs', '--kind', 'decisions']);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entries: { id: string; title: string }[] = JSON.parse(result.stdout);
    expect(entries.length).toBeGreaterThan(EXIT_SUCCESS);
    const first = entries[EXIT_SUCCESS];
    assert(first, 'expected at least one entry');
    expect(first.id).toMatch(/^D\d+$/u);
  });
});

describe('ledger slugs — axes', () => {
  it('returns JSON entries for --kind axes', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'slugs', '--kind', 'axes']);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entries: { axis: string; id: string }[] = JSON.parse(result.stdout);
    expect(entries.length).toBeGreaterThan(EXIT_SUCCESS);
    expect(entries.map((entry) => entry.axis)).toContain('correctness');
  });

  it('exits 2 with an error when --kind is unknown', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'slugs', '--kind', 'bogus']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('unknown ledger kind');
  });
});

describe('ledger get', () => {
  it('returns the full entry body for a known slug', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'get', '--kind', 'rejected', '--id', 'pin-literal-source-close']);
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout).toContain('## R01');
    expect(result.stdout).toContain('pin-literal-source-close');
  });

  it('accepts the numeric id as the lookup key', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'get', '--kind', 'rejected', '--id', 'R01']);
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout).toContain('## R01');
  });

  it('exits 1 with a diagnostic for an unknown id', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'get', '--kind', 'rejected', '--id', 'no-such-slug']);
    expect(result.status).toBe(EXIT_NOT_FOUND);
    expect(result.stderr).toContain('no entry');
  });

  it('exits 2 when --id is missing', () => {
    expect.hasAssertions();
    const result = run(['ledger', 'get', '--kind', 'rejected']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('--id is required');
  });
});

describe('axis brief', () => {
  it('returns the axis prompt body for a known axis', () => {
    expect.hasAssertions();
    const result = run(['axis', 'brief', '--name', 'correctness']);
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout).toContain('# Axis: correctness');
  });

  it('exits 1 for an unknown axis', () => {
    expect.hasAssertions();
    const result = run(['axis', 'brief', '--name', 'no-such-axis']);
    expect(result.status).toBe(EXIT_NOT_FOUND);
    expect(result.stderr).toContain('no axis brief');
  });

  it('exits 2 when --name is missing', () => {
    expect.hasAssertions();
    const result = run(['axis', 'brief']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('--name is required');
  });
});

describe('canon', () => {
  it('returns the full TDD-CANON.md body', () => {
    expect.hasAssertions();
    const result = run(['canon']);
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout).toContain('Canon');
    expect(result.stdout).toContain('Red → Green → Refactor');
  });
});

const setupStateFixture = (): {
  stateDir: string;
  statePath: string;
  getBackup: () => string | undefined;
  getDirCreated: () => boolean;
} => {
  const stateDir = path.join(import.meta.dirname, '..', '..', '.claude', 'state');
  const statePath = path.join(stateDir, 'review-last-findings.json');
  let backup: string | undefined = MISSING;
  let dirCreated = false;

  beforeEach(() => {
    if (existsSync(statePath)) {
      backup = readFileSync(statePath, 'utf8');
    } else {
      backup = MISSING;
    }
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
      dirCreated = true;
    }
    writeFileSync(
      statePath,
      JSON.stringify({
        correctness: {
          clean_run_count: CLEAN_RUN_COUNT_ONE,
          head_sha: '0000000000000000000000000000000000000000',
          round_verdict: 'clean (1/2)',
        },
      }),
    );
  });

  afterEach(() => {
    if (backup === MISSING) {
      rmSync(statePath, { force: true });
      if (dirCreated) {
        rmSync(stateDir, { force: true, recursive: true });
      }
    } else {
      writeFileSync(statePath, backup);
    }
  });

  return {
    getBackup: (): string | undefined => backup,
    getDirCreated: (): boolean => dirCreated,
    stateDir,
    statePath,
  };
};

describe('state (read side)', () => {
  setupStateFixture();

  it('state list returns convergence entries', () => {
    expect.hasAssertions();
    const result = run(['state', 'list']);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entries: { axis: string; clean_run_count: number }[] = JSON.parse(result.stdout);
    expect(entries.length).toBeGreaterThan(EXIT_SUCCESS);
    expect(entries[EXIT_SUCCESS]).toHaveProperty('axis');
    expect(entries[EXIT_SUCCESS]).toHaveProperty('clean_run_count');
  });

  it('state get returns the entry for a known axis', () => {
    expect.hasAssertions();
    const result = run(['state', 'get', '--axis', 'correctness']);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entry: { head_sha?: string } = JSON.parse(result.stdout);
    expect(entry).toHaveProperty('head_sha');
  });

  it('state get exits 1 for an unknown axis', () => {
    expect.hasAssertions();
    const result = run(['state', 'get', '--axis', 'no-such-axis']);
    expect(result.status).toBe(EXIT_NOT_FOUND);
    expect(result.stderr).toContain('no state for axis');
  });
});

const OBS_FIXTURE = [
  '# Observations log',
  '',
  '## 2026-06-01 — correctness — old-slug',
  '',
  'Old note.',
  '',
  '## 2026-06-08 — docs-sync — newer-slug',
  '',
  'Newer note.',
  '',
].join('\n');

describe('observations (read side)', () => {
  let tempDir = '';
  let target = '';
  const getTempDir = (): string => tempDir;
  const getTarget = (): string => target;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'siro-ctx-obs-read-'));
    target = path.join(tempDir, 'OBSERVATIONS.md');
    writeFileSync(target, OBS_FIXTURE);
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it('observations recent returns all entries without filters', () => {
    expect.hasAssertions();
    const result = run(['observations', 'recent', '--path', getTarget()]);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entries: { slug: string }[] = JSON.parse(result.stdout);
    expect(entries.map((entry) => entry.slug)).toStrictEqual(['old-slug', 'newer-slug']);
  });

  it('observations recent --since filters by date inclusive', () => {
    expect.hasAssertions();
    const result = run(['observations', 'recent', '--since', '2026-06-05', '--path', getTarget()]);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entries: { slug: string }[] = JSON.parse(result.stdout);
    expect(entries.map((entry) => entry.slug)).toStrictEqual(['newer-slug']);
  });

  it('observations recent --axis filters by axis name', () => {
    expect.hasAssertions();
    const result = run(['observations', 'recent', '--axis', 'correctness', '--path', getTarget()]);
    expect(result.status).toBe(EXIT_SUCCESS);
    const entries: { slug: string }[] = JSON.parse(result.stdout);
    expect(entries.map((entry) => entry.slug)).toStrictEqual(['old-slug']);
  });

  it('observations recent returns [] when the file does not exist', () => {
    expect.hasAssertions();
    const result = run(['observations', 'recent', '--path', path.join(getTempDir(), 'missing.md')]);
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(JSON.parse(result.stdout)).toStrictEqual([]);
  });

  it('observations get returns the heading + body for a known slug', () => {
    expect.hasAssertions();
    const result = run(['observations', 'get', '--slug', 'old-slug', '--path', getTarget()]);
    expect(result.status).toBe(EXIT_SUCCESS);
    expect(result.stdout).toContain('## 2026-06-01 — correctness — old-slug');
    expect(result.stdout).toContain('Old note.');
  });

  it('observations get exits 1 for an unknown slug', () => {
    expect.hasAssertions();
    const result = run(['observations', 'get', '--slug', 'no-such', '--path', getTarget()]);
    expect(result.status).toBe(EXIT_NOT_FOUND);
    expect(result.stderr).toContain('no observation');
  });
});
