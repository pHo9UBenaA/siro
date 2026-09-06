import type { Task } from 'tinybench';

export interface BenchRow {
  readonly fixture: string;
  readonly opsPerSec: number;
  readonly msPerOp: number;
  readonly sd: number;
  readonly p99: number;
  readonly samples: number;
}

export const extractBenchRows = (tasks: readonly Pick<Task, 'name' | 'result'>[]): BenchRow[] => {
  if (tasks.length === 0) throw new Error('No benchmark tasks were measured.');
  return tasks.map(({ name, result }) => {
    if (result.state === 'errored') {
      throw new Error(`Benchmark '${name}' failed: ${result.error.message}`, {
        cause: result.error,
      });
    }
    if (result.state !== 'completed') {
      throw new Error(`Benchmark '${name}' did not complete (${result.state}).`);
    }
    return {
      fixture: name,
      msPerOp: result.latency.mean,
      opsPerSec: result.throughput.mean,
      p99: result.latency.p99,
      samples: result.latency.samplesCount,
      sd: result.latency.sd,
    };
  });
};

export const printBench = (rows: readonly BenchRow[]): void => {
  if (process.env.BENCH_JSON === '1') {
    console.log(JSON.stringify({ bench: 'lint', node: process.version, results: rows }));
    return;
  }
  console.log(`\nsiro lint throughput (Node ${process.version})\n`);
  console.table(
    rows.map((row) => ({
      fixture: row.fixture,
      'ms/op': row.msPerOp.toFixed(3),
      'ops/sec': row.opsPerSec.toFixed(0),
      p99: row.p99.toFixed(3),
      samples: row.samples,
      '± sd': row.sd.toFixed(3),
    })),
  );
};
