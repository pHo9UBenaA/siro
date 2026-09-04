import { resolveDenoProjectType } from '../../../src/domain/services/project-type.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe(resolveDenoProjectType, () => {
  it('treats empty and whitespace-only names as applications', () => {
    expect.hasAssertions();
    const projectTypes = [{ name: '' }, { name: '   ' }].map((config) =>
      resolveDenoProjectType(makeCtx(), config),
    );
    expect(projectTypes).toStrictEqual(['application', 'application']);
  });
});
