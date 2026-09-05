import { lintCommand } from '../../src/application/commands/lint.ts';
import { ConfigError, UsageError } from '../../src/shared/errors.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';
import { captureIO } from '../helpers/io.ts';

const options = { cwd: asAbsPath('/repo'), fs: npmGoodFs(), reporter: 'json' };

it('rejects an invalid project type from JavaScript', async () => {
  await expect(
    // @ts-expect-error Exercise the untyped boundary.
    lintCommand({ ...options, projectType: 'service' }, captureIO().io),
  ).rejects.toBeInstanceOf(UsageError);
});

it('rejects an invalid package manager from JavaScript', async () => {
  // @ts-expect-error Exercise the untyped boundary.
  await expect(lintCommand({ ...options, pm: 'cargo' }, captureIO().io)).rejects.toBeInstanceOf(
    UsageError,
  );
});

it('rejects an invalid severity from JavaScript', async () => {
  await expect(
    // @ts-expect-error Exercise the untyped boundary.
    lintCommand({ ...options, severity: 'fatal' }, captureIO().io),
  ).rejects.toBeInstanceOf(UsageError);
});

it('rejects a malformed custom rule from JavaScript', async () => {
  await expect(
    // @ts-expect-error Exercise the untyped boundary.
    lintCommand({ ...options, config: { customRules: [null] } }, captureIO().io),
  ).rejects.toBeInstanceOf(ConfigError);
});
