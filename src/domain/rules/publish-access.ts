import { type RuleBinding, defineRule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { isPublishable } from './publishable.ts';

const { packageJson } = CONFIG_FILES;

const publishAccessBinding: RuleBinding = {
  // Same ctx.packageJson rationale as files-field.ts: typed valibot view,
  // advisory-only binding.
  check(ctx) {
    if (!isPublishable(ctx)) {
      return { state: 'na' };
    }
    const access = ctx.packageJson?.publishConfig?.access;
    if (access === 'public' || access === 'restricted') {
      return { state: 'ok' };
    }
    return {
      remediation: {
        kind: 'manual',
        steps: [
          'Add `"publishConfig": { "access": "public" }` (or `"restricted"`) to package.json so publishes never default unexpectedly.',
        ],
      },
      actual: access,
      message:
        'Set `publishConfig.access` in package.json to `public` or `restricted` to declare publish scope explicitly.',
      state: 'violation',
    };
  },
  docs: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig',
  file: packageJson,
};

export const publishAccess = defineRule({
  bindings: {
    aube: publishAccessBinding,
    bun: publishAccessBinding,
    npm: {
      ...publishAccessBinding,
      docs: 'https://docs.npmjs.com/cli/v12/using-npm/config#access',
      check(ctx, config) {
        if (isPublishable(ctx) && ctx.packageJson?.publishConfig?.access === 'private') {
          return { state: 'ok' };
        }
        return publishAccessBinding.check(ctx, config);
      },
    },
    pnpm: publishAccessBinding,
    yarn: publishAccessBinding,
  },
  description:
    'Set `publishConfig.access` so a misconfigured scope or registry never accidentally publishes an internal package publicly.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#for-maintainers',
  id: 'publish-access',
  projectTypes: ['package'],
  severity: 'info',
  title: 'Declare publish access explicitly',
});
