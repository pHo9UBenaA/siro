/** Output sink for commands; injectable so tests can drive a string buffer. */
export interface IO {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}
