#!/usr/bin/env node
// Scaffold a new rule:
//   pnpm gen:rule <id>                # AutoRuleBinding (requireConfigKey)
//   pnpm gen:rule <id> --advisory     # AdvisoryRuleBinding (custom check)
//   pnpm gen:rule <id> --dry-run      # print the plan and exit without writing
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createScriptContext } from '../_shared/script-runtime.mjs';
import path from 'node:path';
import { rollbackWrites } from './lib/rule-rollback.mjs';
import { shortenRollbackPaths } from './lib/rule-paths.mjs';

const ARGV_SKIP = 2;
const EXIT_USAGE = 2;
const EXIT_FAILURE = 1;

const ctx = createScriptContext(import.meta.url);
const { root } = ctx;
const { insertBuiltinRuleEntries, insertRuleIdEntry, isValidRuleId, kebabToCamel, renderRuleFile } =
  await ctx.loadLib('scripts/gen/lib/rule-scaffolder.ts');

const args = process.argv.slice(ARGV_SKIP);
const id = args.find((arg) => !arg.startsWith('--'));
let type = 'auto';
if (args.includes('--advisory')) {
  type = 'advisory';
}
const dryRun = args.includes('--dry-run');

if (!id) {
  ctx.fail('usage: pnpm gen:rule <id> [--advisory] [--dry-run]', EXIT_USAGE);
}
if (!isValidRuleId(id)) {
  ctx.fail(`invalid rule id: '${id}' (must be kebab-case, e.g. 'enforce-2fa')`, EXIT_USAGE);
}

const camelId = kebabToCamel(id);
const ruleFilePath = path.join(root, 'src', 'domain', 'rules', `${id}.ts`);
const ruleIdFilePath = path.join(root, 'src', 'domain', 'entities', 'rule-id.ts');
const builtinRulesFilePath = path.join(root, 'src', 'domain', 'builtin-rules.ts');

if (existsSync(ruleFilePath)) {
  ctx.fail(`rule file already exists: ${ruleFilePath}`, EXIT_USAGE);
}

// Phase 1 (plan): read every source file once, compute its target content
// up front, and use the same snapshot for both the transform input and the
// rollback baseline. Re-reading would open a TOCTOU window where a concurrent
// writer between the two reads could make rollback restore a state that
// never actually existed on disk before this script ran. If any pure
// transform throws (duplicate marker, missing array sentinel, …), we exit
// before touching anything.
const ruleIdSource = readFileSync(ruleIdFilePath, 'utf8');
const builtinRulesSource = readFileSync(builtinRulesFilePath, 'utf8');

const writes = [
  {
    nextContent: renderRuleFile(id, camelId, type),
    path: ruleFilePath,
    // creating a new file
    previousContent: void 0,
  },
  {
    nextContent: insertRuleIdEntry(ruleIdSource, id),
    path: ruleIdFilePath,
    previousContent: ruleIdSource,
  },
  {
    nextContent: insertBuiltinRuleEntries(builtinRulesSource, id, camelId),
    path: builtinRulesFilePath,
    previousContent: builtinRulesSource,
  },
];

if (dryRun) {
  ctx.logSuccess('gen-rule: dry run — no files will be written.');
  for (const wr of writes) {
    let verb = '~ modify';
    if (typeof wr.previousContent === 'undefined') {
      verb = '+ create';
    }
    ctx.logSuccess(`${verb}  ${path.relative(root, wr.path)}`);
  }
  ctx.logSuccess(
    `\nGenerated docs (docs/rules.md, docs/comparison.md) would be regenerated after.`,
  );
} else {
  // Phase 2 (apply): write every file inside a try/catch and roll back any
  // already-applied writes on first failure. Without rollback, a mid-loop
  // failure (permissions / disk full / signal) would leave the repo in a
  // half-scaffolded state where the rule file exists but rule-id.ts /
  // builtin-rules.ts never registered it — the next `gen:rule` invocation
  // would then trip the `existsSync` guard above and block.
  const applied = [];
  try {
    for (const wr of writes) {
      writeFileSync(wr.path, wr.nextContent);
      applied.push(wr);
    }
  } catch (error) {
    const { error: logError } = console;
    rollbackWrites(applied, { unlinkSync, writeFileSync }, (msg) => {
      logError(`gen-rule: ${shortenRollbackPaths(msg, root)}`);
    });
    let errMsg = String(error);
    if (error instanceof Error) {
      errMsg = error.message;
    }
    ctx.fail(
      `write failed after ${applied.length}/${writes.length} file(s); previous state restored — ${errMsg}`,
      EXIT_USAGE,
    );
  }

  // Re-render docs against the registry this run just rewrote. Node caches
  // ESM by URL, so builtin-rules.ts is loaded with { fresh: true } to
  // re-evaluate exactly that file from disk; the render functions take the
  // fresh registry explicitly (doc-generator's default param would bind the
  // cached, pre-write module). One in-process call also replaces the
  // previous pair of `execFileSync('node', ...)` child invocations, saving
  // the two node-startup hits.
  //
  // Doc regeneration sits outside the rollback guard because docs/*.md are
  // derived artifacts — a failure here doesn't invalidate the registered
  // rule, but a raw stack trace would obscure that the registration
  // succeeded. Catch and surface a recovery hint instead.
  //
  // Exit code 1 (not 2): the pre-write validation branches above use 2
  // to signal "nothing was written; safe to retry the same command".
  // A doc-regen failure means the registration *did* land, so CI keying
  // on exit 2 for "no-op failure" must not see this case as a no-op.
  try {
    const { renderRulesDoc, renderComparison } = await ctx.loadLib(
      'scripts/gen/lib/doc-generator.ts',
    );
    const { rules } = await ctx.loadLib('src/domain/builtin-rules.ts', { fresh: true });
    writeFileSync(path.join(root, 'docs/rules.md'), renderRulesDoc(rules));
    writeFileSync(path.join(root, 'docs/comparison.md'), renderComparison(rules));
  } catch (error) {
    let errMsg = String(error);
    if (error instanceof Error) {
      errMsg = error.message;
    }
    ctx.fail(
      `rule registered but doc regeneration failed — rerun \`pnpm gen:rules && pnpm gen:comparison\` to recover. (${errMsg})`,
      EXIT_FAILURE,
    );
  }

  ctx.logSuccess(`Created src/domain/rules/${id}.ts (${type})`);
  ctx.logSuccess(`Registered '${id}' in BUILTIN_RULE_IDS and rules array.`);
  ctx.logSuccess('Regenerated docs/rules.md and docs/comparison.md.');
  ctx.logSuccess('');
  ctx.logSuccess('Next:');
  ctx.logSuccess('  1. Edit the new file: fill bindings, severity, description, docs URL.');
  ctx.logSuccess('  2. Rerun `pnpm gen:rules && pnpm gen:comparison` after editing —');
  ctx.logSuccess('     the initial regen above only captures the empty stub.');
  ctx.logSuccess('  3. Add a fixture or assertion in test/ to cover the rule.');
  ctx.logSuccess('  4. See docs/contributing.md → "Adding a rule" for the full guide.');
}
