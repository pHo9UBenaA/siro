import { CONFIG_FILES } from '../config-files.ts';
import { isPublishable } from './publishable.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { proposeChanges } from './remediation.ts';
import { guardRemediationAvailability } from './remediation-availability.ts';

const { npmrc, yarnrc } = CONFIG_FILES;

const npmrcProvenance = {
  file: npmrc,
  keyPath: ['provenance'] as const,
  message: 'Set `provenance=true` (and publish from CI) to attest releases.',
  value: true,
};

const baseRule = requireConfigKey({
  applies: isPublishable,
  bindings: {
    bun: {
      ...npmrcProvenance,
      docs: 'https://github.com/oven-sh/bun/issues/15601',
      message:
        'Set `provenance=true` in .npmrc and publish via `bunx npm publish` from CI — `bun publish` does not emit provenance attestations natively (tracking: oven-sh/bun#15601).',
    },
    npm: {
      ...npmrcProvenance,
      docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#provenance',
      versionNote: { configAvailableSince: 'npm 9.5.0' },
    },
    pnpm: {
      ...npmrcProvenance,
      // pnpm publish reads `.npmrc` for npm-side flags including provenance.
      docs: 'https://pnpm.io/cli/publish',
    },
    yarn: {
      docs: 'https://yarnpkg.com/configuration/yarnrc#npmPublishProvenance',
      file: yarnrc,
      keyPath: ['npmPublishProvenance'],
      message: 'Set `npmPublishProvenance: true` (and publish from CI) to attest releases.',
      value: true,
    },
  },
  description:
    'Provenance statements (via Sigstore) bind a published artifact to its recorded source and build.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#11-generate-provenance-statements',
  id: 'provenance',
  projectTypes: ['package'],
  severity: 'warn',
  title: 'Publish with provenance',
});

const npmBinding = baseRule.bindings.npm;
if (npmBinding === undefined) throw new TypeError('Provenance requires an npm binding.');

export const provenance = overrideBindings(baseRule, {
  npm: {
    ...npmBinding,
    check(ctx, config) {
      if (!isPublishable(ctx)) return { state: 'na' };
      const publishConfig = ctx.packageJson?.publishConfig;
      if (!publishConfig || !Object.hasOwn(publishConfig, 'provenance')) {
        return npmBinding.check(ctx, config);
      }
      if (publishConfig.provenance === true) return { state: 'ok' };
      const file = CONFIG_FILES.packageJson;
      return {
        state: 'violation',
        file: file.path,
        actual: publishConfig.provenance,
        expected: true,
        message:
          'Set publishConfig.provenance=true in package.json (and publish from CI) to attest releases.',
        remediation: guardRemediationAvailability(
          'npm',
          ctx.pmVersion,
          proposeChanges(ctx.readConfig(file), [
            { file, op: 'setKey', keyPath: ['publishConfig', 'provenance'], value: true },
          ]),
        ),
      };
    },
  },
});
