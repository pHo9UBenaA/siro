import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';
import { isPublishable } from './publishable.ts';

const { packageJson, denoJson } = CONFIG_FILES;

const packageJsonFilesBinding: AdvisoryRuleBinding = {
  // Advisory binding — uses ctx.packageJson (typed valibot view) instead
  // of the codec-agnostic ParsedConfig so `files` arrives as
  // `string[] | undefined` without a cast.
  check(ctx) {
    if (!isPublishable(ctx)) {
      return { state: 'na' };
    }
    let files: string[] | undefined = void 0;
    if (ctx.packageJson) {
      ({ files } = ctx.packageJson);
    }
    const EMPTY = 0;
    if (Array.isArray(files) && files.length > EMPTY) {
      return { state: 'ok' };
    }
    return {
      actual: files,
      message: 'Add a `files` allow-list to package.json to limit what gets published.',
      state: 'violation',
    };
  },
  docs: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json#files',
  file: packageJson,
  fix() {
    return [
      {
        file: packageJson,
        message:
          'Add a `files` array to package.json (e.g. ["dist"]) and verify with `npm pack --dry-run`.',
        op: 'note',
      },
    ];
  },
  fixKind: 'advisory',
};

// Deno publishes to JSR via deno.json `publish.include`. A deno.json without
// a `name` cannot be published to JSR, so the rule is N/A for internal/CLI
// deno repos — mirroring the `isPublishable` guard used by the package.json
// binding (whose privacy signal is `private: true` rather than missing name).
const denoPublishBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    if (typeof getByPath(config, ['name']) !== 'string') {
      return { state: 'na' };
    }
    const include = getByPath(config, ['publish', 'include']);
    const EMPTY = 0;
    if (Array.isArray(include) && include.length > EMPTY) {
      return { state: 'ok' };
    }
    return {
      actual: include,
      message: 'Add `publish.include` to deno.json to limit what gets published.',
      state: 'violation',
    };
  },
  docs: 'https://docs.deno.com/runtime/reference/cli/publish/#how-publishing-works',
  file: denoJson,
  fix() {
    return [
      {
        file: denoJson,
        message: 'Add `publish.include` (and/or `publish.exclude`) to deno.json.',
        op: 'note',
      },
    ];
  },
  fixKind: 'advisory',
};

export const filesField: Rule = {
  bindings: {
    aube: packageJsonFilesBinding,
    bun: packageJsonFilesBinding,
    deno: denoPublishBinding,
    npm: packageJsonFilesBinding,
    pnpm: packageJsonFilesBinding,
    yarn: packageJsonFilesBinding,
  },
  description:
    'An explicit `files` array in package.json restricts what gets published, preventing accidental inclusion of secrets or local files.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#11-review-published-files',
  id: 'files-field',
  severity: 'info',
  title: 'Declare a published files allow-list',
};
