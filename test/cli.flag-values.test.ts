import { run } from '../src/cli.ts';
import { captureIO } from './helpers/io.ts';

const EXIT_USAGE = 2;

describe('invalid boolean flags', () => {
  it.each(['--json=false', '--version=0', '--no-json', '--workspaces=false'])(
    'rejects %s before linting',
    async (flag) => {
      const { io, err } = captureIO();
      expect(await run(['lint', 'test/fixtures/npm-good', flag], io)).toBe(EXIT_USAGE);
      expect(err()).toMatch(/flag|option/iu);
    },
  );
});

it.each(['--reporter', '--pm', '--severity', '--project-type'])(
  'rejects a missing value for %s',
  async (flag) => {
    const { io, err } = captureIO();
    expect(await run(['lint', flag], io)).toBe(EXIT_USAGE);
    expect(err()).toContain(flag + ' requires a value');
  },
);
