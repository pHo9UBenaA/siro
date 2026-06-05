import type { IO } from '../domain/ports/io.ts';

export const nodeIO: IO = {
  stderr: (line) => process.stderr.write(`${line}\n`),
  stdout: (line) => process.stdout.write(`${line}\n`),
};
