// Type-only sidecar for scan-long-comments.mjs. The .mjs file stays .mjs so
// review-preflight can invoke it directly; this declaration file lets tests
// and the TS-aware editor see the exported `parseBlocks` shape.

export interface CommentBlock {
  startLine: number;
  endLine: number;
  lineCount: number;
  content: string;
}

export function parseBlocks(text: string): CommentBlock[];
