import { createBuiltinRules } from './core/rules/builtin-rules.ts';
import { compileExclusions } from './adapters/exclusions.ts';
import { lint as evaluate, type LintOptions } from './core/lint.ts';
import { lintCommand as report, type LintCommandOptions } from './core/lint-command.ts';
import type { LintDependencies } from './core/contracts/lint-dependencies.ts';
import type { IO } from './core/contracts/io.ts';
import {
  createNodeFileSystem,
  nodeFileSystem,
  assertDirectory,
} from './adapters/node-file-system.ts';
import { resolveScanLimits } from './core/contracts/scan-limits.ts';
import { UsageError } from './core/contracts/errors.ts';
import { nodePaths } from './adapters/node-paths.ts';
import { createRepoContext } from './adapters/repo-context.ts';
import { createCodecFor } from './adapters/codecs/store.ts';
import { DEFAULT_REPORTER_NAME, createRegistry } from './adapters/reporters/registry.ts';

/** Read time at evaluation, never at module initialization. */
export const rules = createBuiltinRules({
  now: () => Date.now(),
  parse: (value) => Date.parse(value),
});

const prepareRuntime = <Options extends LintOptions>(
  options: Options,
): { options: Options; dependencies: LintDependencies } => {
  if (!options || !nodePaths.isAbsolute(options.cwd))
    throw new UsageError('cwd must be an absolute filesystem path.');
  const limits = resolveScanLimits(options.limits);
  if (options.rejectSymlinks !== undefined && typeof options.rejectSymlinks !== 'boolean')
    throw new UsageError('rejectSymlinks must be a boolean.');
  const usesNativeFileSystem = options.fs === undefined || options.fs === nodeFileSystem;
  if (options.rejectSymlinks && !usesNativeFileSystem)
    throw new UsageError(
      'rejectSymlinks requires the native filesystem; an injected FileSystem is trusted code.',
    );
  if (usesNativeFileSystem) assertDirectory(options.cwd);
  const fileSystem = usesNativeFileSystem
    ? createNodeFileSystem(limits, options.rejectSymlinks ? options.cwd : undefined)
    : options.fs;
  const dependencies: LintDependencies = {
    rules,
    fileSystem,
    paths: nodePaths,
    createRepoContext: (root, fs, projectType) =>
      createRepoContext(root, fs, projectType, limits.maxConfigDepth),
    codecFor: createCodecFor(limits),
    compileExclusions,
  };
  // Explicit use of the public singleton also receives fresh native budgets.
  return {
    options: options.fs === nodeFileSystem ? { ...options, fs: undefined } : options,
    dependencies,
  };
};

/** Public Node API: callers can replace the filesystem without assembling the application. */
export const lint = (options: LintOptions) => {
  const prepared = prepareRuntime(options);
  return evaluate(prepared.options, prepared.dependencies);
};

export const lintCommand = async (options: LintCommandOptions, io: IO): Promise<number> => {
  const prepared = prepareRuntime(options);
  return report(prepared.options, io, prepared.dependencies, {
    defaultName: DEFAULT_REPORTER_NAME,
    createRegistry,
  });
};

export type { LintOptions, LintCommandOptions };
