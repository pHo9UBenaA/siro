import { Bench } from 'tinybench';
import { extractBenchRows, printBench } from './bench-row.ts';
import { fixtures } from './fixtures.ts';
import { asAbsPath, lintCommand } from '../src/index.ts';
import { createMemFileSystem } from '../test/helpers/memfs.ts';

const bench = new Bench({ time: 500, warmupTime: 100 });
const discardOutput = { stderr() {}, stdout() {} };

for (const fixture of fixtures) {
  const fs = createMemFileSystem(fixture.files, '/');
  bench.add(fixture.name, () =>
    lintCommand(
      { cwd: asAbsPath('/repo'), fs, reporter: 'pretty', ...fixture.options },
      discardOutput,
    ),
  );
}

await bench.run();
printBench(extractBenchRows(bench.tasks));
