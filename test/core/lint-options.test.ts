import { lintCommand } from '../../src/runtime.ts';
import { ConfigError, UsageError } from '../../src/core/contracts/errors.ts';
import { asAbsPath } from '../../src/adapters/node-paths.ts';
import { npmPassingFs } from '../helpers/fixtures.ts';
import { captureIO } from '../helpers/io.ts';

const options = { cwd: asAbsPath('/repo'), fs: npmPassingFs(), reporter: 'json' };

it.each([
  { name: 'project type', invalid: { projectType: 'service' }, error: UsageError },
  { name: 'package manager', invalid: { pm: 'cargo' }, error: UsageError },
  { name: 'severity', invalid: { severity: 'fatal' }, error: UsageError },
  { name: 'custom rule', invalid: { config: { customRules: [null] } }, error: ConfigError },
])('rejects an invalid $name from JavaScript', async ({ invalid, error }) => {
  await expect(
    Reflect.apply(lintCommand, undefined, [{ ...options, ...invalid }, captureIO().io]),
  ).rejects.toBeInstanceOf(error);
});

it.each([null, undefined])('rejects missing command options %s from JavaScript', async (value) => {
  await expect(
    Reflect.apply(lintCommand, undefined, [value, captureIO().io]),
  ).rejects.toBeInstanceOf(UsageError);
});
