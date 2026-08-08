const REQUIRED_REVIEW_ASSETS = [
  '.claude/skills/review/SKILL.md',
  '.claude/agents/code-reviewer-axis.md',
  '.claude/agents/finding-triage.md',
  '.claude/agents/observation-promoter.md',
  '.claude/agents/scoped-fixer.md',
  '.claude/agents/axes/architecture-drift.md',
  '.claude/agents/axes/comment-rot.md',
  '.claude/agents/axes/correctness.md',
  '.claude/agents/axes/dead-code.md',
  '.claude/agents/axes/docs-sync.md',
  '.claude/agents/axes/perf-hotspot.md',
  '.claude/agents/axes/tdd-discipline.md',
  '.claude/agents/axes/test-brittleness.md',
  '.claude/agents/axes/type-safety.md',
  'docs/review/AXES.md',
  'docs/review/DECISIONS.md',
  'docs/review/OBSERVATIONS.md',
  'docs/review/REJECTED.md',
  'docs/review/TDD-CANON.md',
] as const;

export const findMissingReviewAssets = (
  exists: (relativePath: string) => boolean,
): readonly string[] => REQUIRED_REVIEW_ASSETS.filter((relativePath) => !exists(relativePath));
