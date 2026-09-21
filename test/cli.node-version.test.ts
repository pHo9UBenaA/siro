import { ensureNodeVersion } from '../src/cli/parsers.ts';

describe('node.js version requirement', () => {
  it('rejects Node 22 before 22.18', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('22.17.0')).toThrow('Node ^22.18.0 || ^24.0.0 required');
  });

  it('accepts Node 22.18', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('22.18.0')).not.toThrow();
  });

  it('accepts Node 24', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('24.0.0')).not.toThrow();
  });
});

it.each(['23.6.0', '25.0.0'])('rejects an unsupported or malformed runtime %s', (version) => {
  expect(() => ensureNodeVersion(version)).toThrow(/required/u);
});
