import type { Bench, Task } from 'tinybench';
import type { IO } from '../src/domain/ports/io.ts';

// Indirect reference so test spies (vi.spyOn) still intercept at call time.
const stdio: Console = globalThis.console;

export const WARMUP_MS = 100;
export const MEASURE_MS = 500;

// Intentional no-ops: bench tasks discard IO.
const noop = (): void => {
  /* no-op */
};
export const noopIO: IO = Object.freeze({ stderr: noop, stdout: noop });

export interface BenchRow {
  readonly fixture: string;
  readonly opsPerSec: number | undefined;
  readonly msPerOp: number | undefined;
  readonly sd: number | undefined;
  readonly p99: number | undefined;
  readonly samples: number | undefined;
}

export type BenchName = 'lint';

const nullRow = (fixture: string): BenchRow => ({
  fixture,
  msPerOp: void 0,
  opsPerSec: void 0,
  p99: void 0,
  samples: void 0,
  sd: void 0,
});

const rowForTask = (task: Task): BenchRow => {
  const res = task.result;
  if (res.state === 'errored') {
    stdio.error(`\nbench task "${task.name}" errored: ${res.error.message}`);
    process.exitCode = 1;
    return nullRow(task.name);
  }
  if (res.state !== 'completed' && res.state !== 'aborted-with-statistics') {
    return nullRow(task.name);
  }
  return {
    fixture: task.name,
    msPerOp: res.latency.mean,
    opsPerSec: res.throughput.mean,
    p99: res.latency.p99,
    samples: res.latency.samplesCount,
    sd: res.latency.sd,
  };
};

export const extractBenchRows = (bench: Bench): BenchRow[] => bench.tasks.map(rowForTask);

const MS_DECIMALS = 3;
const OPS_DECIMALS = 0;

const fmtFixed = (value: number | undefined, decimals: number): string => {
  if (typeof value === 'undefined') {
    return 'n/a';
  }
  return value.toFixed(decimals);
};

const formatRow = (row: BenchRow): Record<string, string | number> => ({
  // 3-decimal precision: sd on the fastest fixtures drops below 0.01ms,
  // so a 2-decimal column would print '0.00' and mask real variance.
  fixture: row.fixture,
  'ms/op': fmtFixed(row.msPerOp, MS_DECIMALS),
  'ops/sec': fmtFixed(row.opsPerSec, OPS_DECIMALS),
  p99: fmtFixed(row.p99, MS_DECIMALS),
  samples: row.samples ?? 'n/a',
  '± sd': fmtFixed(row.sd, MS_DECIMALS),
});

export const printBench = (rows: readonly BenchRow[], bench: BenchName): void => {
  if (process.env.BENCH_JSON === '1') {
    stdio.log(JSON.stringify({ bench, node: process.version, results: rows }));
    return;
  }
  stdio.log(`\nsiro ${bench} throughput (Node ${process.version})\n`);
  stdio.table(rows.map((row) => formatRow(row)));
};
