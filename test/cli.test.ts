import * as publicApi from '../src/index.ts';
import { captureIO } from './helpers/io.ts';
import { run } from '../src/cli.ts';

vi.setConfig({ testTimeout: 5000 });

const EXIT_OK = 0;
const EXIT_USAGE = 2;

const capture = (args: readonly string[]): Promise<string> => {
  const { io, out } = captureIO();
  return run(args, io).then(() => out());
};

const reporterLine = (text: string): string | undefined =>
  text.split('\n').find((line) => /^\s*--reporter\b/u.test(line));

const runExpectCode = (
  args: readonly string[],
): Promise<{ code: number; out: string; err: string }> => {
  const { io, out, err } = captureIO();
  return run(args, io).then((code) => ({ code, err: err(), out: out() }));
};

const describeVersionBranch = (): void => {
  test('prints a SemVer version with --version and exits 0', () => {
    expect.hasAssertions();
    // Pinning the literal version couples every release commit to a test
    // update; SemVer matches the contract without forcing churn.
    return runExpectCode(['--version']).then(({ code, out }) => {
      expect(code).toBe(EXIT_OK);
      expect(out.trim()).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/u);
    });
  });

  test('prints the version with -v (alias of --version)', () => {
    expect.hasAssertions();
    // cac registers `-v` as an alias of --version; the pre-cac scanner must
    // honor it too, or `siro -v` falls through to cac (bypassing injected IO)
    // and lands in the usage/exit-2 branch.
    return runExpectCode(['-v']).then(({ code, out }) => {
      expect(code).toBe(EXIT_OK);
      expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/u);
    });
  });
};

const describeHelpBranch = (): void => {
  test('prints usage with --help and exits 0', () => {
    expect.hasAssertions();
    return runExpectCode(['--help']).then(({ code, out }) => {
      expect(code).toBe(EXIT_OK);
      expect(out).toMatch(/USAGE\n {2}siro <command>/u);
      expect(out).toContain('COMMANDS');
      expect(out).toContain('EXAMPLES');
    });
  });

  test('shows the lint-specific help with `siro lint --help`', () => {
    expect.hasAssertions();
    return runExpectCode(['lint', '--help']).then(({ code, out }) => {
      expect(code).toBe(EXIT_OK);
      expect(out).toContain('siro lint —');
      expect(out).toContain('EXIT CODES');
    });
  });
};

const describeFlagInteraction = (): void => {
  test('treats `--help` after a value-flag as the help request, not the flag value', () => {
    expect.hasAssertions();
    // `--reporter --help` must show help: a `-`-prefixed token is never a
    // flag's value, so the pre-cac scanner must not swallow `--help` as the
    // reporter value (which would fall through to the lint/usage branch).
    return runExpectCode(['--reporter', '--help']).then(({ code, out }) => {
      expect(code).toBe(EXIT_OK);
      expect(out).toMatch(/USAGE\n {2}siro <command>/u);
    });
  });

  test('treats `--version` after a value-flag as the version request, not the flag value', () => {
    expect.hasAssertions();
    // Companion to the --help case; the shared skip predicate must keep
    // `--reporter --version` from eating --version as the reporter value.
    return runExpectCode(['--reporter', '--version']).then(({ code, out }) => {
      expect(code).toBe(EXIT_OK);
      expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/u);
    });
  });

  test('shows lint help for `--reporter json lint --help` (flag value is not the target)', () => {
    expect.hasAssertions();
    // The value of a value-taking flag must not be mistaken for the command
    // positional; otherwise `json` looks like the help target and the root
    // help shows instead of the lint help.
    return runExpectCode(['--reporter', 'json', 'lint', '--help']).then(({ code, out }) => {
      expect(code).toBe(EXIT_OK);
      expect(out).toContain('siro lint —');
    });
  });
};

const describeUsageErrors = (): void => {
  test('prints usage and exits 2 when no subcommand is given', () => {
    expect.hasAssertions();
    return runExpectCode([]).then(({ code, err }) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err).toMatch(/usage/iu);
    });
  });

  test('exits 2 for an unknown subcommand', () => {
    expect.hasAssertions();
    return runExpectCode(['frobnicate']).then(({ code, err }) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err).toMatch(/unknown command/iu);
    });
  });

  test('exits 2 for an unknown --reporter', () => {
    expect.hasAssertions();
    return runExpectCode(['lint', '--reporter', 'xml']).then(({ code, err }) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err).toMatch(/unknown reporter/iu);
    });
  });

  test('exits 2 for an unknown --pm', () => {
    expect.hasAssertions();
    return runExpectCode(['lint', '--pm', 'cargo']).then(({ code, err }) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err).toMatch(/unknown package manager/iu);
    });
  });

  test('exits 2 for an unknown flag (typo guard)', () => {
    expect.hasAssertions();
    return runExpectCode(['lint', '--repoter', 'pretty']).then(({ code, err }) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err).toMatch(/unknown flag/iu);
    });
  });

  test('exits 2 when --write is passed to lint (wrong scope)', () => {
    expect.hasAssertions();
    return runExpectCode(['lint', '--write']).then(({ code, err }) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err).toMatch(/unknown flag.*write/iu);
    });
  });
};

const describePassthroughAndConflict = (): void => {
  test('rejects non-empty passthrough after `--` (siro wraps no tool)', () => {
    expect.hasAssertions();
    // siro takes no passthrough args — there is no wrapped tool to forward to.
    // `--` still stops flag detection (so `--version` after it is NOT a version
    // request), but a non-empty payload is a usage error rather than silently
    // dropped. This also means the version branch never fires here.
    return runExpectCode(['lint', '--', '--version']).then(({ code, err }) => {
      expect(code).toBe(EXIT_USAGE);
      expect(err).not.toMatch(/^\d+\.\d+\.\d+/u);
    });
  });

  test('rejects combining --reporter with --json (exit 2)', () => {
    expect.hasAssertions();
    // The two select the reporter by different routes; using both is
    // ambiguous intent. Reject rather than silently letting one win — applies
    // to a genuine conflict (--reporter github --json) and the redundant
    // synonym (--reporter json --json) alike.
    const cases = [
      ['lint', '--reporter', 'github', '--json'],
      ['lint', '--reporter', 'json', '--json'],
    ];
    return Promise.all(
      cases.map((args) =>
        runExpectCode(args).then(({ code, err }) => {
          expect(code).toBe(EXIT_USAGE);
          expect(err).toMatch(/reporter|json/iu);
        }),
      ),
    );
  });
};

const describeErrorPropagation = (): void => {
  test('re-throws a non-SiroError instead of swallowing it (bootstrap maps it to exit 70)', () => {
    expect.hasAssertions();
    // run() maps SiroError to an exit code but lets unexpected errors
    // propagate so the process bootstrap can give them a dedicated exit (70),
    // distinct from the exit-1 "findings found" path. Embedders catch it too.
    const throwingIo = {
      stderr: (): void => {
        // no-op
      },
      stdout: (): void => {
        throw new Error('boom');
      },
    };
    return expect(run(['--version'], throwingIo)).rejects.toThrow('boom');
  });
};

const describeReporterConsistency = (): void => {
  test('renders the --reporter flag line identically in root and lint help', () => {
    expect.hasAssertions();
    // Companion to the --pm test above. --reporter only appears in two
    // pages, and both must agree.
    return Promise.all([capture(['--help']), capture(['lint', '--help'])]).then(
      ([rootHelp, lintHelp]) => {
        const rootLine = reporterLine(rootHelp);
        const lintLine = reporterLine(lintHelp);
        expect(rootLine).toBeDefined();
        expect(lintLine).toStrictEqual(rootLine);
      },
    );
  });
};

describe('cli', () => {
  describeVersionBranch();
  describeHelpBranch();
  describeFlagInteraction();
  describeUsageErrors();
  describePassthroughAndConflict();
  describeErrorPropagation();
  describeReporterConsistency();
});

describe('extra positional rejection', () => {
  it('exits 2 when more than one positional follows the command', () => {
    expect.hasAssertions();
    return runExpectCode(['lint', '.', 'extra']).then(({ code }) => {
      expect(code).toBe(EXIT_USAGE);
    });
  });

  it('names the unexpected argument on stderr', () => {
    expect.hasAssertions();
    return runExpectCode(['lint', '.', 'extra']).then(({ err }) => {
      expect(err).toContain('extra');
    });
  });
});

describe('public API surface', () => {
  it('exposes detectPMs for embedders authoring custom rules', () => {
    expect.hasAssertions();
    expect(publicApi.detectPMs).toBeTypeOf('function');
  });
});
