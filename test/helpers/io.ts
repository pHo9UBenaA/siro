import type { IO } from '../../src/domain/ports/io.ts';

export interface CapturedIO {
  readonly io: IO;
  out: () => string;
  err: () => string;
}

export const captureIO = (): CapturedIO => {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return {
    err: () => errLines.join('\n'),
    io: {
      stderr: (line) => errLines.push(line),
      stdout: (line) => outLines.push(line),
    },
    out: () => outLines.join('\n'),
  };
};
