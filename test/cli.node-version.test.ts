import { ensureNodeVersion } from '../src/cli/parsers.ts';

vi.setConfig({ testTimeout: 5000 });

describe('node.js version requirement', () => {
  it('rejects Node 20', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('20.19.0')).toThrow(
      'Node ^22.18.0 || ^23.6.0 || >=24.0.0 required',
    );
  });

  it('rejects Node 22 before 22.18', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('22.17.0')).toThrow(
      'Node ^22.18.0 || ^23.6.0 || >=24.0.0 required',
    );
  });

  it('accepts Node 22.18', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('22.18.0')).not.toThrow();
  });

  it('rejects Node 23 before 23.6', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('23.5.0')).toThrow(
      'Node ^22.18.0 || ^23.6.0 || >=24.0.0 required',
    );
  });

  it('accepts Node 23.6', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('23.6.0')).not.toThrow();
  });

  it('accepts Node 24', () => {
    expect.hasAssertions();
    expect(() => ensureNodeVersion('24.0.0')).not.toThrow();
  });
});
