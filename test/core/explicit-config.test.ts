import { lintCommand, type LintCommandOptions } from '../../src/runtime.ts';
import { asAbsPath } from '../../src/adapters/node-paths.ts';
import { captureIO } from '../helpers/io.ts';
import { npmPassingFs } from '../helpers/fixtures.ts';

it('uses the supplied config without probing executable config files in an injected filesystem', async () => {
  const base = npmPassingFs();
  const fs = {
    ...base,
    exists: (file: Parameters<typeof base.exists>[0]) => {
      if (file.includes('siro.config')) throw new Error('Executable config must be explicit');
      return base.exists(file);
    },
  };
  const { io } = captureIO();
  const options = {
    cwd: asAbsPath('/repo'),
    fs,
    reporter: 'json',
    config: {},
  } satisfies LintCommandOptions;
  expect(await lintCommand(options, io)).toBe(0);
});
