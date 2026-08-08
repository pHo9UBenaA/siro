// State file parsers for on-disk review state.

const JSON_INDENT = 2;
const JSON_REPLACER = (_key: string, val: unknown): unknown => val;

export interface StateAxisEntry {
  readonly head_sha?: string;
  readonly clean_run_count?: number;
  readonly round_verdict?: string;
  readonly [key: string]: unknown;
}

export interface StateAxisSummary {
  readonly axis: string;
  readonly head_sha?: string;
  readonly clean_run_count?: number;
  readonly round_verdict?: string;
}

export const getStateForAxis = (stateRaw: string, axis: string): StateAxisEntry | undefined => {
  const state: Record<string, StateAxisEntry> = JSON.parse(stateRaw);
  return state[axis];
};

export const listStateAxes = (stateRaw: string): StateAxisSummary[] => {
  const state: Record<string, StateAxisEntry> = JSON.parse(stateRaw);
  return Object.entries(state).map(([axis, entry]) => ({
    axis,
    clean_run_count: entry.clean_run_count,
    head_sha: entry.head_sha,
    round_verdict: entry.round_verdict,
  }));
};

export const updateState = (
  stateRaw: string,
  axis: string,
  entry: Record<string, unknown>,
): string => {
  const trimmed = stateRaw.trim();
  let state: Record<string, unknown> = {};
  if (trimmed !== '') {
    state = JSON.parse(trimmed);
  }
  state[axis] = entry;
  return `${JSON.stringify(state, JSON_REPLACER, JSON_INDENT)}\n`;
};
