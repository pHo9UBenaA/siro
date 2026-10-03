import type { Writable } from 'node:stream';
import type { IO } from '../core/contracts/io.ts';

const createStreamLineWriter = (stream: Writable): ((line: string) => Promise<void>) => {
  let failure: Error | undefined;
  const pendingRejects = new Set<(error: Error) => void>();
  const fail = (cause: unknown): Error => {
    failure ??= new Error(
      `Output failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    for (const reject of pendingRejects) reject(failure);
    pendingRejects.clear();
    return failure;
  };
  let isObservingErrors = false;
  return (line) => {
    // Importing the library must not intercept unrelated process stream errors.
    // A callback may precede the error event, so retain one listener after first use.
    if (!isObservingErrors) {
      isObservingErrors = true;
      stream.on('error', fail);
      stream.on('close', () => fail(new Error('Output stream closed.')));
    }
    return new Promise<void>((resolve, reject) => {
      if (failure || stream.destroyed) {
        reject(failure ?? fail(new Error('Output stream is destroyed.')));
        return;
      }
      pendingRejects.add(reject);
      try {
        stream.write(`${line}\n`, (error) => {
          pendingRejects.delete(reject);
          if (error) reject(fail(error));
          else resolve();
        });
      } catch (error) {
        fail(error);
      }
    });
  };
};

/** Node-only construction; keep streams and their errors outside the core. */
export const createNodeIO = (stdout: Writable, stderr: Writable): IO => ({
  stdout: createStreamLineWriter(stdout),
  stderr: createStreamLineWriter(stderr),
});

export const nodeIO: IO = createNodeIO(process.stdout, process.stderr);
