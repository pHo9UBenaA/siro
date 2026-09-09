import path from 'node:path';
import picomatch from 'picomatch';
import { ConfigError } from '../shared/errors.ts';

interface Brace {
  start: number;
  end: number;
  commas: number[];
}

// List alternatives can introduce slashes, globstars, or empty segments.
// Expand them before splitting the path; numeric ranges stay with Node.
const pathAlternatives = (pattern: string): string[] => {
  const pending = [pattern];
  const result: string[] = [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    const braces: Brace[] = [];
    const stack: Brace[] = [];
    for (let i = 0; i < current.length; i++) {
      if (current[i] === '{') {
        const brace: Brace = { start: i, end: -1, commas: [] };
        stack.push(brace);
        braces.push(brace);
      } else if (current[i] === ',') stack.at(-1)?.commas.push(i);
      else if (current[i] === '}') {
        const brace = stack.pop();
        if (brace) brace.end = i;
      }
    }
    const brace = braces.find((item) => item.end >= 0 && item.commas.length > 0);
    if (!brace) {
      result.push(current);
      continue;
    }
    const boundaries = [brace.start, ...brace.commas, brace.end];
    if (result.length + pending.length + boundaries.length - 1 > 4096)
      throw new ConfigError('Workspace pattern exceeds 4096 directory alternatives.');
    for (let i = 1; i < boundaries.length; i++) {
      pending.push(
        current.slice(0, brace.start) +
          current.slice(boundaries[i - 1]! + 1, boundaries[i]) +
          current.slice(brace.end + 1),
      );
    }
  }
  return result;
};

const globstar = Symbol('globstar');
type Segment = typeof globstar | ((name: string) => boolean);

const compileSegment = (pattern: string): Segment => {
  if (pattern === '**') return globstar;
  // Node's bracket, brace-range and parenthesis semantics are part of the
  // existing contract. Keep those uncommon segments on the native matcher.
  if (/[[\]{}()]/u.test(pattern)) return (name) => path.posix.matchesGlob(name, pattern);
  if (!/[?*]/u.test(pattern)) return (name) => name === pattern;
  return picomatch(pattern, {
    nocase: process.platform === 'darwin' || process.platform === 'win32',
    nonegate: true,
    windows: false,
    strictSlashes: true,
  });
};

/** Whether at least one further directory can complete a declared pattern. */
export const descendantMatcher = (
  patterns: readonly string[],
): ((directory: string) => boolean) => {
  const alternatives = patterns
    .flatMap(pathAlternatives)
    .map((pattern) =>
      path.posix.normalize(pattern).replace(/\/+$/u, '').split('/').map(compileSegment),
    );
  return (directory) =>
    alternatives.some((segments) => {
      let positions = new Set([0]);
      for (const name of directory.split('/')) {
        // A globstar can consume zero segments before the following matcher.
        for (const position of positions) {
          if (segments[position] === globstar) positions.add(position + 1);
        }
        const next = new Set<number>();
        for (const position of positions) {
          const segment = segments[position];
          if (segment === globstar) {
            if (!name.startsWith('.')) next.add(position);
          } else if (segment?.(name)) next.add(position + 1);
        }
        if (next.size === 0) return false;
        positions = next;
      }
      return [...positions].some((position) => position < segments.length);
    });
};
