import { asAbsPath, lint, lintCommand, type SiroConfig } from '../../src/index.ts';
import { npmPassingFs } from '../helpers/fixtures.ts';
import { captureIO } from '../helpers/io.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

const options = {
  cwd: asAbsPath('/repo'),
  fs: createMemFileSystem({}),
  installationRoots: [],
  pm: 'npm' as const,
};
const asyncValues = [
  { name: 'resolved Promise', create: () => Promise.resolve({ state: 'ok' }) },
  { name: 'rejected Promise', create: () => Promise.reject(new Error('rejected')) },
  {
    name: 'rejecting thenable',
    create: () => ({
      then(_resolve: unknown, reject: (error: Error) => void) {
        reject(new Error('thenable rejected'));
      },
    }),
  },
];

it.each(asyncValues)(
  'rejects a $name without process-wide rejection handlers',
  async ({ create }) => {
    expect(() => lint({ ...options, config: create() as unknown as SiroConfig })).toThrow(
      /synchronous/,
    );
    expect(() =>
      lint({
        ...options,
        config: {
          customRules: [
            {
              id: 'async-probe',
              title: 'Async probe',
              description: 'Return an unsupported async check result.',
              severity: 'error',
              bindings: { npm: { check: () => create() as never } },
            },
          ],
        },
      }),
    ).toThrow(/async-probe.*synchronous/);
    // Vitest itself detects any escaped unhandled rejection after this turn.
    await new Promise<void>((resolve) => setImmediate(resolve));
  },
);

it.each([undefined, null, new Error('sink failure')])(
  'preserves thrown sink values including %s',
  async (failure) => {
    await expect(
      lintCommand(
        {
          ...options,
          reporter: {
            name: 'swallowing',
            format(_result, io) {
              try {
                io.stdout('message');
              } catch {
                /* Deliberately swallowed. */
              }
            },
          },
        },
        {
          stdout() {
            throw failure;
          },
          stderr() {},
        },
      ),
    ).rejects.toBe(failure);
  },
);

it('awaits pending writes but gives a reporter failure precedence over a sink failure', async () => {
  const reporterFailure = new Error('reporter failure');
  let writeSettled = false;
  await expect(
    lintCommand(
      {
        ...options,
        reporter: {
          name: 'failing',
          format(_result, io) {
            io.stdout('message');
            throw reporterFailure;
          },
        },
      },
      {
        stdout: () =>
          new Promise<void>((_resolve, reject) =>
            setImmediate(() => {
              writeSettled = true;
              reject(new Error('sink failure'));
            }),
          ),
        stderr() {},
      },
    ),
  ).rejects.toBe(reporterFailure);
  expect(writeSettled).toBe(true);
});

it('observes writes from legacy synchronous reporters, even if they catch a synchronous sink failure', async () => {
  const failure = new Error('output failed');
  for (const stdout of [
    () => Promise.reject(failure),
    () => {
      throw failure;
    },
  ]) {
    await expect(
      lintCommand(
        {
          ...options,
          reporter: {
            name: 'legacy',
            format(_result, io, context) {
              expect(context.cwd).toBe(options.cwd);
              try {
                io.stdout('message');
              } catch {
                /* The command must still fail. */
              }
            },
          },
        },
        { stdout, stderr() {} },
      ),
    ).rejects.toBe(failure);
  }
});

it('awaits a delayed output rejection rather than resolving a clean lint command', async () => {
  const failure = new Error('delayed output failure');
  let reject: (error: Error) => void = () => {};
  const write = new Promise<void>((_resolve, rejectWrite) => {
    reject = rejectWrite;
  });
  // Observe immediately so the red test itself does not create an unhandled rejection.
  void write.catch(() => {});
  const result = lintCommand(
    {
      cwd: asAbsPath('/repo'),
      fs: createMemFileSystem({}),
      installationRoots: [],
      reporter: 'json',
    },
    {
      stdout: () => write,
      stderr() {},
    },
  );
  reject(failure);
  await expect(result).rejects.toBe(failure);
});

describe('Reporter completion and failures', () => {
  const passingOptions = { cwd: asAbsPath('/repo'), fs: npmPassingFs() };

  it('propagates reporter rejection even after partial output', async () => {
    const failure = new Error('Output failed');
    const { io, out } = captureIO();
    await expect(
      lintCommand(
        {
          ...passingOptions,
          reporter: {
            name: 'partial',
            async format(_result, targetIO) {
              targetIO.stdout('partial');
              await Promise.resolve();
              throw failure;
            },
          },
        },
        io,
      ),
    ).rejects.toBe(failure);
    expect(out()).toContain('partial');
  });

  it('propagates a reporter IO failure without reclassifying it', async () => {
    const failure = new Error('Broken output stream');
    await expect(
      lintCommand(
        { ...passingOptions, reporter: 'json' },
        {
          stdout() {
            throw failure;
          },
          stderr() {},
        },
      ),
    ).rejects.toBe(failure);
  });

  it('waits for asynchronous reporting before returning the lint exit code', async () => {
    const { io, out } = captureIO();
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    let settled = false;
    const command = lintCommand(
      {
        ...passingOptions,
        reporter: 'async',
        config: {
          customRules: [
            {
              id: 'custom',
              title: 'Custom',
              description: 'Makes the command fail',
              severity: 'error',
              bindings: {
                npm: { check: () => ({ state: 'violation', message: 'custom violation' }) },
              },
            },
          ],
          reporters: [
            {
              name: 'async',
              async format(result, targetIO) {
                expect(result.findings).toContainEqual(
                  expect.objectContaining({ ruleId: 'custom' }),
                );
                await ready;
                await targetIO.stdout('reported');
              },
            },
          ],
        },
      },
      io,
    ).then((code) => {
      settled = true;
      return code;
    });
    try {
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(out()).toBe('');
    } finally {
      release();
      await command;
    }
    expect(await command).toBe(1);
    expect(out()).toContain('reported');
  });
});
