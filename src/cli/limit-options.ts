import { DEFAULT_SCAN_LIMITS, type ScanLimits } from '../core/contracts/scan-limits.ts';

const options: Record<
  keyof ScanLimits,
  { flag: string; description: string; descriptionColumn?: number }
> = {
  maxFileBytes: { flag: 'max-file-bytes', description: 'Bound each input file' },
  maxTotalBytes: {
    flag: 'max-total-bytes',
    description: 'Bound all input reads',
    descriptionColumn: 25,
  },
  maxEntries: { flag: 'max-entries', description: 'Bound native directory entries' },
  maxDirectories: { flag: 'max-directories', description: 'Bound discovered directories' },
  maxDirectoryDepth: { flag: 'max-directory-depth', description: 'Bound discovery depth' },
  maxConfigDepth: { flag: 'max-config-depth', description: 'Bound configuration nesting' },
  maxFindings: { flag: 'max-findings', description: 'Bound unfiltered findings' },
  maxOutputBytes: { flag: 'max-output-bytes', description: 'Bound report output' },
};

export const LIMIT_OPTIONS = Object.entries(options).map(([key, option]) => ({
  key: key as keyof ScanLimits,
  ...option,
}));

export const limitHelp = LIMIT_OPTIONS.map(
  ({ key, flag, description, descriptionColumn = 24 }) =>
    `${`  --${flag} <n> `.padEnd(descriptionColumn)}${description} (default ${DEFAULT_SCAN_LIMITS[key]})`,
).join('\n');
