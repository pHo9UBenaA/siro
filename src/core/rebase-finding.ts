import type { Finding } from './contracts/lint-result.ts';
import type { RelPath } from './contracts/paths.ts';
import type { Remediation, SetKeyOperation } from './contracts/rule.ts';

const rebaseRemediation = (
  directory: RelPath,
  remediation: Remediation | undefined,
): Remediation | undefined => {
  if (!remediation) return undefined;
  if (remediation.kind === 'manual') {
    return {
      ...remediation,
      steps: [`Work in ${directory} for this finding.`, ...remediation.steps],
    };
  }
  const rebaseOperation = (operation: SetKeyOperation): SetKeyOperation => ({
    ...operation,
    file: { ...operation.file, path: `${directory}/${operation.file.path}` as RelPath },
  });
  const [first, ...rest] = remediation.operations;
  return { ...remediation, operations: [rebaseOperation(first), ...rest.map(rebaseOperation)] };
};

/** Context-local rule output becomes cwd-relative once, without mutating rule-owned data. */
export const rebaseFinding = (directory: RelPath, finding: Finding): Finding => {
  if (directory === '.') return { ...finding, directory };
  return {
    ...finding,
    directory,
    ...(finding.file === undefined ? {} : { file: `${directory}/${finding.file}` }),
    remediation: rebaseRemediation(directory, finding.remediation),
  };
};
