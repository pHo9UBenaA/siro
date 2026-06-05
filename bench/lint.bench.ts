import { MEASURE_MS, WARMUP_MS, extractBenchRows, noopIO, printBench } from './bench-row.ts';
import { Bench } from 'tinybench';
import { asAbsPath } from '../src/shared/paths.ts';
import { createMemFileSystem } from '../test/helpers/memfs.ts';
import { fixtures } from './fixtures.ts';
import { lintCommand } from '../src/application/commands/lint.ts';

const bench = new Bench({ time: MEASURE_MS, warmupTime: WARMUP_MS });

for (const fixture of fixtures) {
  // The shared `createMemFileSystem` helper rebases keys under `/repo` when
  // `root` is omitted; bench fixtures already include the full `/repo/...`
  // paths, so an explicit `root: '/'` avoids double-prefixing. lintCommand
  // does not mutate the FS, so a single volume per fixture is safe to reuse
  // across iterations.
  const fs = createMemFileSystem(fixture.files, '/');
  bench.add(fixture.name, () =>
    lintCommand({ cwd: asAbsPath('/repo'), fs, reporter: 'pretty' }, noopIO),
  );
}

await bench.run();
printBench(extractBenchRows(bench), 'lint');
