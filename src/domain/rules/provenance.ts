import { CONFIG_FILES } from '../entities/config-files.ts';
import { isPublishable } from './publishable.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { npmrc, yarnrc } = CONFIG_FILES;

const npmrcProvenance = {
  file: npmrc,
  keyPath: ['provenance'] as const,
  message: 'Set `provenance=true` (and publish from CI) to attest releases.',
  value: true,
};

// Coverage notes:
// - deno: N/A — publishes via JSR, which has its own provenance model; there
//   is no npm-style attestation key to require.
// - aube: N/A — no upstream attestation pipeline yet; revisit when aube ships
//   one (docs/version-matrix.md tracks the cell).
export const provenance = requireConfigKey({
  applies: isPublishable,
  bindings: {
    bun: Object.assign({}, npmrcProvenance, {
      docs: 'https://github.com/oven-sh/bun/issues/15601',
      message:
        'Set `provenance=true` in .npmrc and publish via `bunx npm publish` from CI — `bun publish` does not emit provenance attestations natively (tracking: oven-sh/bun#15601).',
    }),
    npm: Object.assign({}, npmrcProvenance, {
      docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#provenance',
      versionNote: { configAvailableSince: 'npm 9.5.0' },
    }),
    pnpm: Object.assign({}, npmrcProvenance, {
      // pnpm publish reads `.npmrc` for npm-side flags including provenance.
      docs: 'https://pnpm.io/cli/publish',
    }),
    yarn: {
      docs: 'https://yarnpkg.com/configuration/yarnrc#npmPublishProvenance',
      file: yarnrc,
      keyPath: ['npmPublishProvenance'],
      message: 'Set `npmPublishProvenance: true` (and publish from CI) to attest releases.',
      value: true,
    },
  },
  description:
    'Provenance statements (via Sigstore) tie a release to its source and build, letting consumers verify it was not tampered with.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#10-generate-provenance-statements',
  id: 'provenance',
  severity: 'warn',
  title: 'Publish with provenance',
});
