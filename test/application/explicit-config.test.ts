import { lintCommand } from '../../src/application/commands/lint.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import { captureIO } from '../helpers/io.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';

it('uses the supplied config without probing executable config files in an injected filesystem', async () => {
  const base = npmGoodFs();
  const fs = {
    ...base,
    exists: (file: Parameters<typeof base.exists>[0]) => {
      if (file.includes('siro.config')) throw new Error('Executable config must be explicit');
      return base.exists(file);
    },
  };
  const { io, out } = captureIO();
  const options = {
    cwd: asAbsPath('/repo'),
    fs,
    reporter: 'json',
    config: { rules: { 'pin-exact-versions': 'off' } },
  } as const;
  expect(await lintCommand(options, io)).toBe(0);
  expect(
    JSON.parse(out()).findings.some((f: { ruleId: string }) => f.ruleId === 'pin-exact-versions'),
  ).toBe(false);
});
