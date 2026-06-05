import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { yarnrc } = CONFIG_FILES;

export const checksumVerification = requireConfigKey({
  bindings: {
    yarn: {
      docs: 'https://yarnpkg.com/configuration/yarnrc#checksumBehavior',
      documentedDefault: 'throw',
      file: yarnrc,
      keyPath: ['checksumBehavior'],
      message:
        'Set `checksumBehavior: throw` in .yarnrc.yml to reject packages whose checksum does not match the lockfile.',
      value: 'throw',
    },
  },
  description:
    'Throw on checksum mismatches so tampered or corrupted packages are never silently installed.',
  docs: 'https://yarnpkg.com/configuration/yarnrc#checksumBehavior',
  id: 'checksum-verification',
  severity: 'warn',
  title: 'Verify package checksums',
});
