import { run } from '../src/cli.ts';
import type { IO } from '../src/domain/ports/io.ts';

const EXIT_USAGE = 2;

const makeIO = (): { io: IO; err: string[] } => {
  const err: string[] = [];
  return {
    err,
    io: {
      stderr: (line: string): void => {
        err.push(line);
      },
      stdout: (): void => {
        // no-op
      },
    },
  };
};

describe('invalid boolean flags', () => {
  it.each(['--json=false', '--version=0', '--no-json', '--workspaces=false'])(
    'rejects %s before linting',
    async (flag) => {
      const { io, err } = makeIO();
      expect(await run(['lint', 'test/fixtures/npm-good', flag], io)).toBe(EXIT_USAGE);
      expect(err.join('\n')).toMatch(/flag|option/iu);
    },
  );
});

it.each(['--reporter', '--pm', '--severity', '--project-type'])(
  'rejects a missing value for %s',
  async (flag) => {
    const { io, err } = makeIO();
    expect(await run(['lint', flag], io)).toBe(EXIT_USAGE);
    expect(err.join('\n')).toContain(flag + ' requires a value');
  },
);
