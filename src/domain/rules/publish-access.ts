import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { isPublishable } from './publishable.ts';

const { packageJson } = CONFIG_FILES;

const publishAccessBinding: AdvisoryRuleBinding = {
  // Same ctx.packageJson rationale as files-field.ts: typed valibot view,
  // advisory-only binding.
  check(ctx) {
    if (!isPublishable(ctx)) {
      return { state: 'na' };
    }
    let access: string | undefined = void 0;
    if (ctx.packageJson && ctx.packageJson.publishConfig) {
      ({ access } = ctx.packageJson.publishConfig);
    }
    if (access === 'public' || access === 'restricted') {
      return { state: 'ok' };
    }
    return {
      actual: access,
      message:
        'Set `publishConfig.access` in package.json to `public` or `restricted` to declare publish scope explicitly.',
      state: 'violation',
    };
  },
  docs: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json#publishconfig',
  file: packageJson,
  fix() {
    return [
      {
        file: packageJson,
        message:
          'Add `"publishConfig": { "access": "public" }` (or `"restricted"`) to package.json so publishes never default unexpectedly.',
        op: 'note',
      },
    ];
  },
  fixKind: 'advisory',
};

export const publishAccess: Rule = {
  bindings: {
    aube: publishAccessBinding,
    bun: publishAccessBinding,
    npm: publishAccessBinding,
    pnpm: publishAccessBinding,
    yarn: publishAccessBinding,
  },
  description:
    'Set `publishConfig.access` so a misconfigured scope or registry never accidentally publishes an internal package publicly.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#for-maintainers',
  id: 'publish-access',
  severity: 'info',
  title: 'Declare publish access explicitly',
};
