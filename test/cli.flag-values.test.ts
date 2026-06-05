import type { IO } from '../src/domain/ports/io.ts';
import { run } from '../src/cli.ts';

vi.setConfig({ testTimeout: 5000 });

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

describe('value flags with a missing value token', () => {
  it('rejects --reporter without a value (exit 2)', () => {
    expect.hasAssertions();
    const { io, err } = makeIO();
    return run(['lint', '--reporter'], io).then((code) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err.join('\n')).toContain('--reporter requires a value');
    });
  });

  it('rejects --pm without a value (exit 2)', () => {
    expect.hasAssertions();
    const { io, err } = makeIO();
    return run(['lint', '--pm'], io).then((code) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err.join('\n')).toContain('--pm requires a value');
    });
  });

  it('rejects --severity without a value (exit 2)', () => {
    expect.hasAssertions();
    const { io, err } = makeIO();
    return run(['lint', '--severity'], io).then((code) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err.join('\n')).toContain('--severity requires a value');
    });
  });
});
