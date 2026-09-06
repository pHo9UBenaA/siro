import { createConfigParser } from '../../src/domain/services/parse-config-file.ts';
import { codecFor } from '../../src/adapters/codecs/store.ts';
import type { RepoContext, RuleContext } from '../../src/domain/ports/repo-context.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

const DEFAULT_ROOT = asAbsPath(path.join(tmpdir(), 'siro-test'));
type ContextOptions = Partial<RuleContext> & { files?: readonly string[] };

export const makeCtx = (overrides: ContextOptions = {}): RuleContext => {
  const present = new Set(overrides.files);
  const ctx: RepoContext = {
    exists: overrides.exists ?? ((file) => present.has(file)),
    packageJson: overrides.packageJson,
    projectType: overrides.projectType,
    readText: overrides.readText ?? (() => undefined),
    root: overrides.root ?? DEFAULT_ROOT,
  };
  return { ...ctx, readConfig: overrides.readConfig ?? createConfigParser(codecFor, ctx) };
};

export const makePublishableCtx = (overrides: ContextOptions = {}): RuleContext =>
  makeCtx({ ...overrides, packageJson: { name: 'x', ...overrides.packageJson } });
