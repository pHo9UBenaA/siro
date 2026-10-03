import { run } from '../src/cli.ts';
import { captureIO } from './helpers/io.ts';

const EXIT_OK = 0;
const EXIT_USAGE = 2;

const runCaptured = async (
  args: readonly string[],
): Promise<{ code: number; out: string; err: string }> => {
  const { io, out, err } = captureIO();
  const code = await run(args, io);
  return { code, err: err(), out: out() };
};

describe('cli', () => {
  test('prints the version with -v (alias of --version)', async () => {
    const { code, out } = await runCaptured(['-v']);

    expect(code).toBe(EXIT_OK);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });

  test('prints usage with --help and exits 0', async () => {
    const { code, out } = await runCaptured(['--help']);

    expect(code).toBe(EXIT_OK);
    expect(out).toMatch(/USAGE\n {2}siro <command>/u);
    expect(out).toContain('COMMANDS');
    expect(out).toContain('EXAMPLES');
  });

  test('shows the lint-specific help with `siro lint --help`', async () => {
    const { code, out } = await runCaptured(['lint', '--help']);

    expect(code).toBe(EXIT_OK);
    expect(out).toContain('siro lint —');
    expect(out).toContain('EXIT CODES');
  });

  test('supports clustered short help and version flags with help precedence', async () => {
    const { code, err, out } = await runCaptured(['-hv']);

    expect(code).toBe(EXIT_OK);
    expect(out).toMatch(/USAGE\n {2}siro <command>/u);
    expect(err).toBe('');
  });

  test('does not treat repeated false help assignments as a help request', async () => {
    const { code, err, out } = await runCaptured(['--help=false', '--help=false']);

    expect(code).toBe(EXIT_USAGE);
    expect(out).toBe('');
    expect(err).toMatch(/--help.*value/iu);
  });

  test('treats `--help` after a value-flag as the help request, not the flag value', async () => {
    // A `-`-prefixed token is another option rather than --reporter's value.
    const { code, out } = await runCaptured(['--reporter', '--help']);

    expect(code).toBe(EXIT_OK);
    expect(out).toMatch(/USAGE\n {2}siro <command>/u);
  });

  test('treats `--version` after a value-flag as the version request, not the flag value', async () => {
    const { code, out } = await runCaptured(['--reporter', '--version']);

    expect(code).toBe(EXIT_OK);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });

  test('shows lint help for `--reporter json lint --help` (flag value is not the target)', async () => {
    const { code, out } = await runCaptured(['--reporter', 'json', 'lint', '--help']);

    expect(code).toBe(EXIT_OK);
    expect(out).toContain('siro lint —');
  });

  test('prints usage and exits 2 when no subcommand is given', async () => {
    const { code, err } = await runCaptured([]);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/usage/iu);
  });

  test('exits 2 for an unknown subcommand', async () => {
    const { code, err } = await runCaptured(['frobnicate']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/unknown command/iu);
  });

  test('exits 2 for an unknown --reporter', async () => {
    const { code, err } = await runCaptured(['lint', '--reporter', 'xml']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/unknown reporter/iu);
  });

  test('exits 2 for an unknown --pm', async () => {
    const { code, err } = await runCaptured(['lint', '--pm', 'cargo']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/unknown package manager/iu);
  });

  test('exits 2 for an unknown --project-type', async () => {
    const { code, err } = await runCaptured(['lint', '--project-type', 'service']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/unknown project type/iu);
  });

  test('exits 2 for an unknown flag (typo guard)', async () => {
    const { code, err } = await runCaptured(['lint', '--repoter', 'pretty']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/unknown flag/iu);
  });

  test('rejects non-empty passthrough after `--` (siro wraps no tool)', async () => {
    const { code, err } = await runCaptured(['lint', '--', '--version']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).not.toMatch(/^\d+\.\d+\.\d+/u);
  });

  test('rejects combining --reporter with --json (exit 2)', async () => {
    const { code, err } = await runCaptured(['lint', '--reporter', 'github', '--json']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/reporter|json/iu);
  });

  test.each(
    [
      ['lint', '--reporter', 'json', '--reporter', 'github'],
      ['lint', '--json', '--json'],
    ].map((args) => ({ args })),
  )('rejects repeated reporter selectors $args (exit 2)', async ({ args }) => {
    const { code, err } = await runCaptured(args);
    expect(code).toBe(EXIT_USAGE);
    expect(err).toMatch(/reporter|json/iu);
  });
});

describe('extra positional rejection', () => {
  it('exits 2 and names an unexpected positional', async () => {
    const { code, err } = await runCaptured(['lint', '.', 'extra']);

    expect(code).toBe(EXIT_USAGE);
    expect(err).toContain('extra');
  });
});

it.each([
  null,
  { code: 'EACCES', errno: -13 },
  Object.assign(new Error('unexpected'), { code: 42, errno: -13 }),
])(
  'preserves unexpected thrown values instead of classifying them as filesystem errors: %j',
  async (failure) => {
    const io = {
      stdout() {
        throw failure;
      },
      stderr() {},
    };
    await expect(run(['--version'], io)).rejects.toBe(failure);
  },
);
