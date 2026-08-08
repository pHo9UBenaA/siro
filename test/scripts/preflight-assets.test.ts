import { findMissingReviewAssets } from '../../scripts/review/lib/preflight-assets.ts';

vi.setConfig({ testTimeout: 5000 });

describe(findMissingReviewAssets, () => {
  it('returns every missing required relative path', () => {
    expect.hasAssertions();
    const present = new Set(['.claude/skills/review/SKILL.md', 'docs/review/AXES.md']);
    expect(findMissingReviewAssets((relativePath) => present.has(relativePath))).toStrictEqual([
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
      'docs/review/DECISIONS.md',
      'docs/review/OBSERVATIONS.md',
      'docs/review/REJECTED.md',
      'docs/review/TDD-CANON.md',
    ]);
  });

  it('returns an empty list when all required assets exist', () => {
    expect.hasAssertions();
    expect(findMissingReviewAssets(() => true)).toStrictEqual([]);
  });
});
