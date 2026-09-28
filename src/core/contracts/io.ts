/** Output sink. Synchronous return values are ignored; returned promises are awaited. */
export interface IO {
  stdout: (line: string) => unknown;
  stderr: (line: string) => unknown;
}
