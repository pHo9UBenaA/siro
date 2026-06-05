import path from 'node:path';
import { spawnSync } from 'node:child_process';

vi.setConfig({ testTimeout: 5000 });

const EXIT_USAGE = 2;

// scripts/gen/rule.mjs mutates checked-in source (src/domain/rules/*.ts,
// rule-id.ts, builtin-rules.ts) so the happy path can only be exercised
// inside a copy of the repo. The exit-2 branches, in contrast, all bail
// out *before* any write — they are safe to spawn against the live tree.
//
// The two pinned branches below catch the two regressions the next
// refactor could plausibly introduce: a `process.exit` that doesn't
// route through `ctx.fail` (would still exit but lose the prefix), and
// an exit code that drifts from 2 to 1 (would change the contract CI
// pipelines may already key off).
const GEN_RULE = path.join(import.meta.dirname, '..', '..', 'scripts', 'gen', 'rule.mjs');

const run = (args: string[]): ReturnType<typeof spawnSync> =>
  spawnSync(process.execPath, [GEN_RULE, ...args], { encoding: 'utf8' });

describe('scripts/gen/rule.mjs exit-2 branches', () => {
  it('exits 2 with a usage hint when no rule id is given', () => {
    expect.hasAssertions();
    const result = run([]);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('gen-rule:');
    expect(result.stderr).toMatch(/usage: pnpm gen:rule/u);
  });

  it('exits 2 with a kebab-case hint when the rule id is invalid', () => {
    expect.hasAssertions();
    const result = run(['CamelCase']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('gen-rule:');
    expect(result.stderr).toMatch(/invalid rule id/u);
  });

  it('exits 2 when the target rule file already exists', () => {
    expect.hasAssertions();
    // disable-lifecycle-scripts is shipped in src/domain/rules/, so the
    // existsSync guard fires before any other validation. This pins
    // both that the guard fires AND that it routes through ctx.fail
    // (exit 2 + `gen-rule:` prefix) — the dryRun branch above (`--dry-run`)
    // would still produce exit 0 here if the guard ever shifted later
    // in the script.
    const result = run(['disable-lifecycle-scripts']);
    expect(result.status).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('gen-rule:');
    expect(result.stderr).toMatch(/already exists/u);
  });
});
