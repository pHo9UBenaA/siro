/** Host time and native date parsing, including the host timezone for offsetless input. */
export interface DateTime {
  now: () => number;
  parse: (value: string) => number;
}
