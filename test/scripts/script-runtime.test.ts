const DEFAULT_EXIT_CODE = 1;
const FIRST_VALUE = 1;
const SECOND_VALUE = 2;
const EXIT_USAGE = 2;
import {
  createScriptContext,
  resolveRoot,
  scriptName,
} from '../../scripts/_shared/script-runtime.mjs';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

class ExitSignalError extends Error {
  public readonly code: number;
  public constructor(code: number) {
    super(`exit(${code})`);
    this.name = 'ExitSignalError';
    this.code = code;
  }
}

const captureThrow = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected fn to throw');
};

const injectableExit =
  (): ((code: number) => never) =>
  (code: number): never => {
    throw new ExitSignalError(code);
  };

const captureStream = (): { stream: { write: (chunk: string) => boolean }; text: () => string } => {
  const chunks: string[] = [];
  const stream = {
    write(chunk: string): boolean {
      chunks.push(chunk);
      return true;
    },
  };
  return { stream, text: (): string => chunks.join('') };
};

describe(resolveRoot, () => {
  it('returns the repo root for a scripts/<name>.mjs URL', () => {
    expect.hasAssertions();
    const fakeUrl = pathToFileURL('/abs/repo/scripts/gen-something.mjs').href;
    expect(resolveRoot(fakeUrl)).toBe('/abs/repo');
  });

  it('returns the repo root for a nested scripts/<ctx>/<name>.mjs URL', () => {
    expect.hasAssertions();
    // Drivers may live one level deeper under a per-context dir; the
    // helper splits on the `scripts/` segment so nesting does not shift
    // the computed root.
    const fakeUrl = pathToFileURL('/abs/repo/scripts/gen/rule.mjs').href;
    expect(resolveRoot(fakeUrl)).toBe('/abs/repo');
  });

  it('returns the repo root for libs under scripts/<ctx>/lib/<name>.ts', () => {
    expect.hasAssertions();
    const fakeUrl = pathToFileURL('/abs/repo/scripts/check/lib/layers.ts').href;
    expect(resolveRoot(fakeUrl)).toBe('/abs/repo');
  });

  it('throws when the caller is not under any scripts/ ancestor', () => {
    expect.hasAssertions();
    const fakeUrl = pathToFileURL('/abs/repo/lib/standalone.mjs').href;
    expect(() => resolveRoot(fakeUrl)).toThrow(/not under scripts\//u);
  });
});

describe(scriptName, () => {
  it('strips the .mjs extension from the basename', () => {
    expect.hasAssertions();
    expect(scriptName(pathToFileURL('/abs/repo/scripts/gen-rule.mjs').href)).toBe('gen-rule');
  });

  it('dash-joins the path segments under scripts/ for nested drivers', () => {
    expect.hasAssertions();
    // `scripts/gen/rule.mjs` keeps the `gen-rule` identity its prior
    // flat-filename had, so error-message prefixes stay stable across
    // the directory-layout migration.
    expect(scriptName(pathToFileURL('/abs/repo/scripts/gen/rule.mjs').href)).toBe('gen-rule');
    expect(scriptName(pathToFileURL('/abs/repo/scripts/bench/run.mjs').href)).toBe('bench-run');
    expect(scriptName(pathToFileURL('/abs/repo/scripts/check/layers.mjs').href)).toBe(
      'check-layers',
    );
  });

  it('falls back to a bare basename for callers outside scripts/', () => {
    expect.hasAssertions();
    // Stray test fixtures (e.g. a .mjs under /tmp) still get a usable
    // tag rather than throwing.
    expect(scriptName(pathToFileURL('/tmp/foo.mjs').href)).toBe('foo');
  });
});

describe('createScriptContext — basic', () => {
  it('exposes the repo root and script name from import.meta.url', () => {
    expect.hasAssertions();
    const ctx = createScriptContext(pathToFileURL('/abs/repo/scripts/gen-rule.mjs').href, {
      exit: injectableExit(),
    });
    expect(ctx.root).toBe('/abs/repo');
    expect(ctx.name).toBe('gen-rule');
  });
});

describe('createScriptContext — fail — message formatting', () => {
  it('writes a prefixed message to stderr and exits with the given code', () => {
    expect.hasAssertions();
    const { stream, text } = captureStream();
    const ctx = createScriptContext(pathToFileURL('/abs/repo/scripts/gen-rule.mjs').href, {
      errStream: stream,
      exit: injectableExit(),
    });
    expect(() => ctx.fail('invalid id', EXIT_USAGE)).toThrow(ExitSignalError);
    expect(text()).toBe('gen-rule: invalid id\n');
  });

  it('defaults to exit code 1 when none is given', () => {
    expect.hasAssertions();
    const ctx = createScriptContext(pathToFileURL('/abs/repo/scripts/gen-version.mjs').href, {
      errStream: captureStream().stream,
      exit: injectableExit(),
    });
    const error = captureThrow(() => ctx.fail('boom'));
    expect(error).toBeInstanceOf(ExitSignalError);
    assert(error instanceof ExitSignalError, 'expected ExitSignalError');
    expect(error.code).toBe(DEFAULT_EXIT_CODE);
  });

  it('accepts an Error and prints just its message by default', () => {
    expect.hasAssertions();
    const { stream, text } = captureStream();
    const ctx = createScriptContext(pathToFileURL('/abs/repo/scripts/gen-rule.mjs').href, {
      env: {},
      errStream: stream,
      exit: injectableExit(),
    });
    const err = new Error('something blew up');
    expect(() => ctx.fail(err)).toThrow(ExitSignalError);
    expect(text()).toBe('gen-rule: something blew up\n');
  });
});

describe('createScriptContext — fail — debug and edge cases', () => {
  it('also prints the stack when SIRO_DEBUG is set, for hard-to-reproduce script failures', () => {
    expect.hasAssertions();
    const { stream, text } = captureStream();
    const ctx = createScriptContext(pathToFileURL('/abs/repo/scripts/gen-rule.mjs').href, {
      env: { SIRO_DEBUG: '1' },
      errStream: stream,
      exit: injectableExit(),
    });
    const err = new Error('something blew up');
    expect(() => ctx.fail(err)).toThrow(ExitSignalError);
    const output = text();
    expect(output).toContain('gen-rule: something blew up');
    expect(output).toContain('Error: something blew up');
  });

  it('stringifies a non-Error, non-string value passed to fail', () => {
    expect.hasAssertions();
    const { stream, text } = captureStream();
    const ctx = createScriptContext(pathToFileURL('/abs/repo/scripts/gen-rule.mjs').href, {
      errStream: stream,
      exit: injectableExit(),
    });
    const ARBITRARY_VALUE = 42;
    const badArg: string = JSON.parse(String(ARBITRARY_VALUE));
    expect(() => ctx.fail(badArg)).toThrow(ExitSignalError);
    expect(text()).toBe('gen-rule: 42\n');
  });
});

describe('createScriptContext — logSuccess', () => {
  it('writes the label plus a trailing newline to stdout', () => {
    expect.hasAssertions();
    const { stream, text } = captureStream();
    const ctx = createScriptContext(pathToFileURL('/abs/repo/scripts/x.mjs').href, {
      exit: injectableExit(),
      outStream: stream,
    });
    ctx.logSuccess('docs/rules.md regenerated.');
    expect(text()).toBe('docs/rules.md regenerated.\n');
  });
});

describe('createScriptContext — loadLib — import', () => {
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(tmpdir(), 'siro-script-runtime-'));
  });

  afterEach(() => {
    rmSync(tempRoot, { force: true, recursive: true });
  });

  it('imports a .ts module relative to the repo root', () => {
    expect.hasAssertions();
    const libDir = path.join(tempRoot, 'scripts', 'lib');
    return import('node:fs')
      .then(({ mkdirSync }) => {
        mkdirSync(libDir, { recursive: true });
        writeFileSync(path.join(tempRoot, 'package.json'), '{}');
        writeFileSync(path.join(tempRoot, 'scripts', 'caller.mjs'), '');
        writeFileSync(path.join(libDir, 'echo.ts'), 'export const greeting = "hi";\n');

        const ctx = createScriptContext(
          pathToFileURL(path.join(tempRoot, 'scripts', 'caller.mjs')).href,
          {
            exit: injectableExit(),
          },
        );
        return ctx.loadLib('scripts/lib/echo.ts');
      })
      .then((mod) => {
        expect(mod).toHaveProperty('greeting', 'hi');
      });
  });

  it('rejects loadLib with a diagnostic when the computed root has no package.json', () => {
    expect.hasAssertions();
    const driverDir = path.join(tempRoot, 'scripts', 'gen');
    return import('node:fs').then(({ mkdirSync }) => {
      mkdirSync(driverDir, { recursive: true });
      writeFileSync(path.join(driverDir, 'rule.mjs'), '');
      const ctx = createScriptContext(pathToFileURL(path.join(driverDir, 'rule.mjs')).href, {
        exit: injectableExit(),
      });
      return expect(ctx.loadLib('scripts/lib/anything.ts')).rejects.toThrow(/no package\.json/u);
    });
  });
});

describe('createScriptContext — loadLib — fresh cache', () => {
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(tmpdir(), 'siro-script-runtime-'));
  });

  afterEach(() => {
    rmSync(tempRoot, { force: true, recursive: true });
  });

  it('re-imports the entry module from disk when { fresh: true } is passed', () => {
    expect.hasAssertions();
    const libDir = path.join(tempRoot, 'scripts', 'lib');
    let libPath = '';
    let ctx: ReturnType<typeof createScriptContext> | undefined = void 0;
    return import('node:fs')
      .then(({ mkdirSync }) => {
        mkdirSync(libDir, { recursive: true });
        libPath = path.join(libDir, 'counter.ts');
        writeFileSync(libPath, 'export const value = 1;\n');
        writeFileSync(path.join(tempRoot, 'package.json'), '{}');
        writeFileSync(path.join(tempRoot, 'scripts', 'caller.mjs'), '');

        ctx = createScriptContext(
          pathToFileURL(path.join(tempRoot, 'scripts', 'caller.mjs')).href,
          {
            exit: injectableExit(),
          },
        );
        return ctx.loadLib('scripts/lib/counter.ts');
      })
      .then((first) => {
        expect(first).toHaveProperty('value', FIRST_VALUE);

        writeFileSync(libPath, 'export const value = 2;\n');

        assert(ctx, 'expected ctx');
        return ctx.loadLib('scripts/lib/counter.ts');
      })
      .then((cachedSecond) => {
        expect(cachedSecond).toHaveProperty('value', FIRST_VALUE);

        assert(ctx, 'expected ctx');
        return ctx.loadLib('scripts/lib/counter.ts', { fresh: true });
      })
      .then((fresh) => {
        expect(fresh).toHaveProperty('value', SECOND_VALUE);
      });
  });
});
