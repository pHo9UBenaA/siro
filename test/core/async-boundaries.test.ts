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
