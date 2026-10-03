/** Host time and native date parsing, including the host timezone for offsetless input. */
export interface DateTime {
  /** Current epoch milliseconds. */
  now: () => number;
  /** Epoch milliseconds, or NaN for invalid input; offsetless dates use host semantics. */
  parse: (value: string) => number;
}
