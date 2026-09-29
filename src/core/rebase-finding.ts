import type { Finding } from './contracts/lint-result.ts';
import type { RelPath } from './contracts/paths.ts';
import type { SetKeyOperation } from './contracts/rule.ts';

/** Context-local rule output becomes cwd-relative once, without mutating rule-owned data. */
export const rebaseFinding = (directory: RelPath, finding: Finding): Finding => {
  if (directory === '.') return { ...finding, directory };
  const remediation = finding.remediation;
  const rebaseOperation = (operation: SetKeyOperation): SetKeyOperation => ({
    ...operation,
    file: { ...operation.file, path: `${directory}/${operation.file.path}` as RelPath },
  });
  return {
    ...finding,
    directory,
    ...(finding.file === undefined ? {} : { file: `${directory}/${finding.file}` }),
    remediation:
      remediation?.kind === 'automatic'
        ? {
            ...remediation,
            operations: [
              rebaseOperation(remediation.operations[0]),
              ...remediation.operations.slice(1).map(rebaseOperation),
            ],
          }
        : remediation?.kind === 'manual'
          ? {
              ...remediation,
              steps: [`Work in ${directory} for this finding.`, ...remediation.steps],
            }
          : remediation,
  };
};
