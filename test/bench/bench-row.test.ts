import type { Statistics, Task } from 'tinybench';
import { extractBenchRows, printBench, type BenchRow } from '../../bench/bench-row.ts';

// Only fields selected by the row formatter vary between measurements.
const statistics = (overrides: Partial<Statistics>): Statistics => ({
  aad: 0,
  critical: 0,
  df: 0,
  mad: 0,
  max: 0,
  mean: 0,
  min: 0,
  moe: 0,
  p50: 0,
  p75: 0,
  p99: 0,
  p995: 0,
  p999: 0,
  rme: 0,
  samples: undefined,
  samplesCount: 0,
  sd: 0,
  sem: 0,
  variance: 0,
  ...overrides,
});
const runtimeInfo = {
  runtime: 'node',
  runtimeVersion: process.version,
  timestampProviderName: 'performanceNow',
} as const;
const completedResult = {
  ...runtimeInfo,
  state: 'completed',
  period: 0,
  totalTime: 0,
  latency: statistics({ mean: 0.08125, p99: 0.1525, samplesCount: 100, sd: 0.0054 }),
  throughput: statistics({ mean: 12_345 }),
} satisfies Task['result'];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('maps completed task statistics in registration order', () => {
  expect(
    extractBenchRows([
      { name: 'first', result: completedResult },
      {
        name: 'second',
        result: {
          ...completedResult,
          latency: statistics({ mean: 0.25, p99: 0.4, samplesCount: 20, sd: 0.02 }),
          throughput: statistics({ mean: 4000 }),
        },
      },
    ]),
  ).toEqual([
    {
      fixture: 'first',
      msPerOp: 0.08125,
      opsPerSec: 12_345,
      p99: 0.1525,
      samples: 100,
      sd: 0.0054,
    },
    {
      fixture: 'second',
      msPerOp: 0.25,
      opsPerSec: 4000,
      p99: 0.4,
      samples: 20,
      sd: 0.02,
    },
  ]);
});

it('fails when a measured task throws', () => {
  expect(() =>
    extractBenchRows([
      {
        name: 'broken',
        result: {
          ...runtimeInfo,
          error: new Error('measurement failed'),
          state: 'errored',
        },
      },
    ]),
  ).toThrow("Benchmark 'broken' failed: measurement failed");
});

it('rejects an empty measurement', () => {
  expect(() => extractBenchRows([])).toThrow('No benchmark tasks');
});

it('rejects an incomplete task even when partial statistics are available', () => {
  expect(() =>
    extractBenchRows([
      {
        name: 'partial',
        result: { ...completedResult, state: 'aborted-with-statistics' },
      },
    ]),
  ).toThrow('did not complete');
});

const row: BenchRow = {
  fixture: 'small',
  msPerOp: 0.08125,
  opsPerSec: 12345,
  p99: 0.1525,
  samples: 100,
  sd: 0.0054,
};

it('preserves numeric precision in JSON output', () => {
  vi.stubEnv('BENCH_JSON', '1');
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  printBench([row]);
  expect(log).toHaveBeenCalledOnce();
  const output = log.mock.calls[0]?.[0];
  if (typeof output !== 'string') throw new TypeError('Expected JSON output');
  expect(JSON.parse(output)).toStrictEqual({
    bench: 'lint',
    node: process.version,
    results: [row],
  });
});

it('formats the table without rounding small variation to zero', () => {
  vi.stubEnv('BENCH_JSON', undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const table = vi.spyOn(console, 'table').mockImplementation(() => {});
  printBench([row]);
  expect(table).toHaveBeenCalledExactlyOnceWith([
    {
      fixture: 'small',
      'ms/op': '0.081',
      'ops/sec': '12345',
      p99: '0.152',
      samples: 100,
      '± sd': '0.005',
    },
  ]);
});
