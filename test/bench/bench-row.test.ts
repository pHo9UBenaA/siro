import { Bench } from 'tinybench';
import { extractBenchRows, printBench, type BenchRow } from '../../bench/bench-row.ts';

const makeBench = () => new Bench({ time: 0, iterations: 2, warmup: false });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it('reports statistics from real completed tasks in registration order', async () => {
  const bench = makeBench()
    .add('first', () => 1 + 1)
    .add('second', () => Math.sqrt(2));
  await bench.run();
  const rows = extractBenchRows(bench.tasks);
  expect(rows.map((row) => row.fixture)).toEqual(['first', 'second']);
  for (const row of rows) {
    expect(row.samples).toBeGreaterThanOrEqual(2);
    expect(row.msPerOp).toBeGreaterThanOrEqual(0);
    expect(row.p99).toBeGreaterThanOrEqual(0);
    expect(row.sd).toBeGreaterThanOrEqual(0);
  }
});

it('fails when a measured task throws', async () => {
  const bench = makeBench().add('broken', () => {
    throw new Error('measurement failed');
  });
  await bench.run();
  expect(() => extractBenchRows(bench.tasks)).toThrow(
    "Benchmark 'broken' failed: measurement failed",
  );
});

it('rejects an empty measurement', () => {
  expect(() => extractBenchRows([])).toThrow('No benchmark tasks');
});

it.each(['not-started', 'started', 'aborted'] as const)('rejects a %s task', (state) => {
  const [task] = makeBench().add('incomplete', () => {}).tasks;
  if (!task) throw new Error('Fixture task missing');
  expect(() => extractBenchRows([{ name: task.name, result: { ...task.result, state } }])).toThrow(
    'did not complete',
  );
});

it('rejects an aborted task even when partial statistics are available', async () => {
  const bench = makeBench().add('partial', () => Math.sqrt(2));
  await bench.run();
  const [task] = bench.tasks;
  if (!task) throw new Error('Fixture task missing');
  const result = task.result;
  if (result.state !== 'completed') throw new Error('Fixture measurement failed');
  expect(() =>
    extractBenchRows([
      { name: 'partial', result: { ...result, state: 'aborted-with-statistics' } },
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
  expect(log).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ bench: 'lint', node: process.version, results: [row] }),
  );
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
