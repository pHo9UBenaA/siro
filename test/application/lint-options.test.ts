import { lintCommand } from '../../src/application/commands/lint.ts';
import { ConfigError, UsageError } from '../../src/shared/errors.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';
import { captureIO } from '../helpers/io.ts';

vi.setConfig({ testTimeout: 5000 });

describe('lintCommand option validation', () => {
  it('rejects an invalid project type from an untyped embedder', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    const projectType = JSON.parse('"service"');

    return expect(
      lintCommand(
        {
          cwd: asAbsPath('/repo'),
          fs: npmGoodFs(),
          projectType,
          reporter: 'json',
        },
        io,
      ),
    ).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects an invalid package manager from an untyped embedder', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    const pm = JSON.parse('"cargo"');

    return expect(
      lintCommand({ cwd: asAbsPath('/repo'), fs: npmGoodFs(), pm, reporter: 'json' }, io),
    ).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects an invalid severity from an untyped embedder', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    const severity = JSON.parse('"fatal"');

    return expect(
      lintCommand({ cwd: asAbsPath('/repo'), fs: npmGoodFs(), reporter: 'json', severity }, io),
    ).rejects.toBeInstanceOf(UsageError);
  });

  it('rejects a malformed custom rule from an untyped embedder', () => {
    expect.hasAssertions();
    const { io } = captureIO();
    const customRules = JSON.parse('[null]');

    return expect(
      lintCommand(
        { config: { customRules }, cwd: asAbsPath('/repo'), fs: npmGoodFs(), reporter: 'json' },
        io,
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });
});
