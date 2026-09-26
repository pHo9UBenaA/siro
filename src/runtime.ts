import { createBuiltinRules } from './core/rules/builtin-rules.ts';
import { minimatchGlobs } from './adapters/workspace-globs.ts';
import { lint as evaluate, type LintOptions } from './core/lint.ts';
import { lintCommand as report, type LintCommandOptions } from './core/lint-command.ts';
import type { LintDependencies } from './core/contracts/lint-dependencies.ts';
import type { IO } from './core/contracts/io.ts';
import { nodeFileSystem } from './adapters/node-file-system.ts';
import { nodePaths } from './adapters/node-paths.ts';
import { createRepoContext } from './adapters/repo-context.ts';
import { codecFor } from './adapters/codecs/store.ts';
import { DEFAULT_REPORTER_NAME, createRegistry } from './adapters/reporters/registry.ts';

/** Read time at evaluation, never at module initialization. */
export const rules = createBuiltinRules({
  now: () => Date.now(),
  parse: (value) => Date.parse(value),
});

const dependencies: LintDependencies = {
  rules,
  fileSystem: nodeFileSystem,
  paths: nodePaths,
  createRepoContext,
  codecFor,
  globs: minimatchGlobs,
  caseInsensitiveGlobs: process.platform === 'darwin' || process.platform === 'win32',
};

/** Public Node API: callers can replace the filesystem without assembling the application. */
export const lint = (options: LintOptions) => evaluate(options, dependencies);

export const lintCommand = (options: LintCommandOptions, io: IO): Promise<number> =>
  report(options, io, dependencies, {
    defaultName: DEFAULT_REPORTER_NAME,
    createRegistry,
  });

export type { LintOptions, LintCommandOptions };
