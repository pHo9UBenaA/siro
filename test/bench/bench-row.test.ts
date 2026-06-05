import type { Bench, Task } from 'tinybench';
import {
  type BenchName,
  type BenchRow,
  MEASURE_MS,
  WARMUP_MS,
  extractBenchRows,
  noopIO,
  printBench,
} from '../../bench/bench-row.ts';
import assert from 'node:assert';

vi.setConfig({ testTimeout: 5000 });

const MISSING: undefined = JSON.parse('{}')._;
const NOOP = (): void => {
  // no-op
};
const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const FIRST_CALL = 0;
const FIRST_ARG = 0;
const ONE_CALL = 1;
const ONE_RESULT = 1;
const EXIT_CODE_ERROR = 1;
const BENCH_OPS = 12_345;
const BENCH_MEAN_MS = 0.081;
const BENCH_SD = 0.012;
const BENCH_P99 = 0.15;
const BENCH_SAMPLES = 1024;
const LAPTOP_BUDGET_MS = 1500;

const serializeTasks = (tasks: readonly { name: string; result: Task['result'] }[]): string =>
  JSON.stringify({ tasks });

const fakeBench = (tasks: readonly { name: string; result: Task['result'] }[]): Bench => {
  const bench: Bench = JSON.parse(serializeTasks(tasks));
  return bench;
};

interface CompletedTaskOptions {
  readonly name: string;
  readonly ops: number;
  readonly mean: number;
  readonly sd: number;
  readonly p99: number;
  readonly samples: number;
}

const makeCompletedTask = (
  opts: CompletedTaskOptions,
): { name: string; result: Task['result'] } => {
  const resultJson = JSON.stringify({
    latency: { mean: opts.mean, p99: opts.p99, samplesCount: opts.samples, sd: opts.sd },
    state: 'completed',
    throughput: { mean: opts.ops },
  });
  const result: Task['result'] = JSON.parse(resultJson);
  return { name: opts.name, result };
};

const makeNullBenchRow = (fixture: string): BenchRow => ({
  fixture,
  msPerOp: void 0,
  opsPerSec: void 0,
  p99: void 0,
  samples: void 0,
  sd: void 0,
});

const makeTaskResult = (obj: Record<string, unknown>): Task['result'] => {
  const json = JSON.stringify(obj);
  const result: Task['result'] = JSON.parse(json);
  return result;
};

const captureConsoleLog = (row: BenchRow, bench: BenchName): { calls: unknown[][] } => {
  const log = vi.spyOn(console, 'log').mockImplementation(NOOP);
  printBench([row], bench);
  const { calls } = log.mock;
  log.mockRestore();
  return { calls };
};

const captureConsoleTable = (
  row: BenchRow,
  bench: BenchName,
): { logCalls: unknown[][]; tableCalls: unknown[][] } => {
  const log = vi.spyOn(console, 'log').mockImplementation(NOOP);
  const table = vi.spyOn(console, 'table').mockImplementation(NOOP);
  printBench([row], bench);
  const logCalls = [...log.mock.calls];
  const tableCalls = [...table.mock.calls];
  log.mockRestore();
  table.mockRestore();
  return { logCalls, tableCalls };
};

describe('extractBenchRows — completed tasks', () => {
  it('maps a completed task to its full row (ops, ms, sd, p99, samples)', () => {
    expect.hasAssertions();
    const completed = makeCompletedTask({
      mean: BENCH_MEAN_MS,
      name: 'small',
      ops: BENCH_OPS,
      p99: BENCH_P99,
      samples: BENCH_SAMPLES,
      sd: BENCH_SD,
    });
    const [row] = extractBenchRows(fakeBench([completed]));
    expect(row).toStrictEqual({
      fixture: 'small',
      msPerOp: BENCH_MEAN_MS,
      opsPerSec: BENCH_OPS,
      p99: BENCH_P99,
      samples: BENCH_SAMPLES,
      sd: BENCH_SD,
    });
  });

  it('preserves task order in the output rows', () => {
    expect.hasAssertions();
    const taskA = makeCompletedTask({
      mean: SECOND_INDEX,
      name: 'a',
      ops: SECOND_INDEX,
      p99: SECOND_INDEX,
      samples: SECOND_INDEX,
      sd: FIRST_INDEX,
    });
    const taskB = Object.assign({}, taskA, { name: 'b' });
    const taskC = Object.assign({}, taskA, { name: 'c' });
    const rows = extractBenchRows(fakeBench([taskA, taskB, taskC]));
    expect(rows.map((row) => row.fixture)).toStrictEqual(['a', 'b', 'c']);
  });
});

describe('extractBenchRows — error / abort states', () => {
  let originalExitCode: typeof process.exitCode = MISSING;

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('returns a null row and sets process.exitCode for an errored task', () => {
    expect.hasAssertions();
    originalExitCode = process.exitCode;
    process.exitCode = FIRST_INDEX;
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(NOOP);
    const result = makeTaskResult({ error: { message: 'boom' }, state: 'errored' });
    const errored = { name: 'crashy', result };
    const [row] = extractBenchRows(fakeBench([errored]));
    expect(row).toStrictEqual(makeNullBenchRow('crashy'));
    expect(process.exitCode).toBe(EXIT_CODE_ERROR);
    expect(consoleErr).toHaveBeenCalledWith(expect.stringContaining('boom'));
    consoleErr.mockRestore();
  });

  it('returns a null row when a task has no throughput / latency fields', () => {
    expect.hasAssertions();
    const result = makeTaskResult({ state: 'aborted' });
    const aborted = { name: 'aborted', result };
    const [row] = extractBenchRows(fakeBench([aborted]));
    expect(row).toStrictEqual(makeNullBenchRow('aborted'));
  });

  it('collapses an unknown future tinybench state to a null row even when stat fields are attached', () => {
    expect.hasAssertions();
    const result = makeTaskResult({
      latency: { mean: 0.5, p99: SECOND_INDEX, samplesCount: 10, sd: 0.1 },
      state: 'aborted-with-partial-data',
      throughput: { mean: 999 },
    });
    const futuristic = { name: 'future', result };
    const [row] = extractBenchRows(fakeBench([futuristic]));
    expect(row).toStrictEqual(makeNullBenchRow('future'));
  });
});

const completedRow: BenchRow = {
  fixture: 'small',
  msPerOp: BENCH_MEAN_MS,
  opsPerSec: BENCH_OPS,
  p99: BENCH_P99,
  samples: BENCH_SAMPLES,
  sd: BENCH_SD,
};

const requireCall = (calls: unknown[][], index: number, label: string): unknown[] => {
  const call = calls[index];
  if (!call) {
    throw new TypeError(`expected ${label} call`);
  }
  return call;
};

const expectJsonBenchShape = (parsed: Record<string, unknown>): void => {
  expect(parsed.bench).toBe('lint');
  expect(parsed.node).toBe(process.version);
  expect(parsed.results).toHaveLength(ONE_RESULT);
  const { results } = parsed;
  if (!Array.isArray(results)) {
    throw new TypeError('expected array');
  }
  expect(results[FIRST_INDEX].fixture).toBe('small');
};

describe('printBench — JSON output', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('emits one JSON line containing node version, bench label, and rows when BENCH_JSON=1', () => {
    expect.hasAssertions();
    vi.stubEnv('BENCH_JSON', '1');
    const { calls } = captureConsoleLog(completedRow, 'lint');
    expect(calls).toHaveLength(ONE_CALL);
    const call = requireCall(calls, FIRST_CALL, 'log');
    const raw = call[FIRST_ARG];
    assert(typeof raw === 'string', 'expected string');
    const parsed = JSON.parse(raw);
    expectJsonBenchShape(parsed);
  });
});

describe('printBench — table output', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to console.table (and a heading) when BENCH_JSON is absent', () => {
    expect.hasAssertions();
    vi.stubEnv('BENCH_JSON', MISSING);
    const { logCalls, tableCalls } = captureConsoleTable(completedRow, 'lint');
    expect(logCalls.length).toBeGreaterThan(FIRST_INDEX);
    const call = requireCall(logCalls, FIRST_CALL, 'log');
    expect(call[FIRST_ARG]).toContain('siro lint throughput');
    expect(tableCalls).toHaveLength(ONE_CALL);
  });

  it('formats null fields as `n/a` in the human-readable table', () => {
    expect.hasAssertions();
    vi.stubEnv('BENCH_JSON', MISSING);
    const emptyRow = makeNullBenchRow('crashy');
    const { tableCalls } = captureConsoleTable(emptyRow, 'lint');
    const call = requireCall(tableCalls, FIRST_CALL, 'table');
    assert(Array.isArray(call[FIRST_ARG]), 'expected array');
    const tableArg: Record<string, unknown>[] = call[FIRST_ARG];
    expect(tableArg[FIRST_INDEX]).toMatchObject({
      'ms/op': 'n/a',
      'ops/sec': 'n/a',
      p99: 'n/a',
      samples: 'n/a',
      '± sd': 'n/a',
    });
  });
});

describe('shared bench constants', () => {
  it('exports a no-op IO suitable for tinybench task functions', () => {
    expect.hasAssertions();
    expect(noopIO.stdout).toBeTypeOf('function');
    expect(noopIO.stderr).toBeTypeOf('function');
    expect(() => {
      noopIO.stdout('x');
      noopIO.stderr('y');
    }).not.toThrow();
  });

  it('freezes noopIO so a stateful-reporter regression surfaces as a TypeError, not silent drift', () => {
    expect.hasAssertions();
    expect(Object.isFrozen(noopIO)).toBe(true);
  });

  it('keeps WARMUP_MS small enough relative to MEASURE_MS to stay inside the ~3s laptop budget', () => {
    expect.hasAssertions();
    expect(WARMUP_MS).toBeGreaterThan(FIRST_INDEX);
    expect(MEASURE_MS).toBeGreaterThan(WARMUP_MS);
    expect(WARMUP_MS + MEASURE_MS).toBeLessThan(LAPTOP_BUDGET_MS);
  });
});
