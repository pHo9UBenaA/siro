import { asAbsPath, lint, lintCommand, type SiroConfig } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

const options = {
  cwd: asAbsPath('/repo'),
  fs: createMemFileSystem({}),
  installationRoots: [],
  pm: 'npm' as const,
};
const asyncValues = [
  () => Promise.resolve({ state: 'ok' }),
  () => Promise.reject(new Error('rejected')),
  () => ({
    then(_resolve: unknown, reject: (error: Error) => void) {
      reject(new Error('thenable rejected'));
    },
  }),
];
it.each(asyncValues)(
  'rejects submitted async values without process-wide rejection handlers',
  async (value) => {
    expect(() => lint({ ...options, config: value() as unknown as SiroConfig })).toThrow(
      /synchronous/,
    );
    expect(() =>
      lint({
        ...options,
        config: {
          customRules: [
            {
              id: 'async-probe',
              title: 't',
              description: 'd',
              severity: 'error',
              bindings: { npm: { check: () => value() as never } },
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
