import { type OssFixture, badFixtures } from './fixtures.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import { codecFor } from '../../src/adapters/codecs/store.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { createRepoContext } from '../../src/adapters/repo-context.ts';
import { rules } from '../../src/domain/builtin-rules.ts';
import { runLint } from '../../src/application/run-lint.ts';

vi.setConfig({ testTimeout: 5000 });

const lintFixture = (fixture: OssFixture): ReturnType<typeof runLint> => {
  const fs = createMemFileSystem(fixture.files);
  const ctx = createRepoContext(asAbsPath('/repo'), fs);
  return runLint({ codecFor, ctx, pms: [fixture.pm], ruleSet: rules });
};

const ruleIds = (result: ReturnType<typeof runLint>): string[] =>
  [...new Set(result.findings.map((finding) => finding.ruleId))].toSorted();

// ---------------------------------------------------------------------------
// Bad benchmarks — projects with minimal / no security config.
// Each snapshot pins the rules moat currently catches. A rule addition that
// adds to these lists is normal; a rule *disappearing* signals a regression.
// ---------------------------------------------------------------------------

describe('oSS benchmark: bad configs — npm fixtures', () => {
  it(`${badFixtures.eslint.name}: detects violations`, () => {
    expect.hasAssertions();
    const result = lintFixture(badFixtures.eslint);
    expect(ruleIds(result)).toMatchInlineSnapshot(`
      [
        "block-exotic-subdeps",
        "commit-lockfile",
        "disable-lifecycle-scripts",
        "enforce-strict-ssl",
        "files-field",
        "minimum-release-age",
        "pin-exact-versions",
        "provenance",
        "publish-access",
        "strict-allow-scripts",
      ]
    `);
  });
});

describe('oSS benchmark: bad configs — pnpm fixtures', () => {
  it(`${badFixtures.svelte.name}: detects violations`, () => {
    expect.hasAssertions();
    const result = lintFixture(badFixtures.svelte);
    expect(ruleIds(result)).toMatchInlineSnapshot(`
      [
        "block-exotic-subdeps",
        "disable-lifecycle-scripts",
        "frozen-lockfile",
        "frozen-store",
        "minimum-release-age",
        "pin-exact-versions",
        "trust-policy",
      ]
    `);
  });
});

describe('oSS benchmark: bad configs — yarn fixtures', () => {
  it(`${badFixtures.jestPreSecurity.name}: detects violations`, () => {
    expect.hasAssertions();
    const result = lintFixture(badFixtures.jestPreSecurity);
    expect(ruleIds(result)).toMatchInlineSnapshot(`
      [
        "approved-git-repos",
        "checksum-verification",
        "disable-lifecycle-scripts",
        "enforce-strict-ssl",
        "frozen-lockfile",
        "hardened-mode",
        "minimum-release-age",
        "pin-exact-versions",
      ]
    `);
  });
});

describe('oSS benchmark: bad configs — bun fixtures', () => {
  it(`${badFixtures.hono.name}: detects violations`, () => {
    expect.hasAssertions();
    const result = lintFixture(badFixtures.hono);
    expect(ruleIds(result)).toMatchInlineSnapshot(`
      [
        "block-auto-install",
        "bun-security-scanner",
        "disable-lifecycle-scripts",
        "files-field",
        "frozen-lockfile",
        "minimum-release-age",
        "pin-exact-versions",
        "provenance",
        "publish-access",
      ]
    `);
  });
});

describe('oSS benchmark: bad configs — deno fixtures', () => {
  it(`${badFixtures.fresh.name}: detects violations`, () => {
    expect.hasAssertions();
    const result = lintFixture(badFixtures.fresh);
    expect(ruleIds(result)).toMatchInlineSnapshot(`
      [
        "frozen-lockfile",
        "minimum-release-age",
        "pin-exact-versions",
      ]
    `);
  });
});
