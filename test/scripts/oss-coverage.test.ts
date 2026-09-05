import { checkCoverage } from '../../oss-benchmarks/coverage.ts';

it('rejects a snapshot with no inspected configurations', () => {
  expect(() => checkCoverage({ updatedAt: 'fixture', entries: [] })).toThrow(Error);
});

it('classifies unknown file names without consulting object prototypes', () => {
  expect(
    checkCoverage({
      updatedAt: 'fixture',
      entries: [
        { project: 'fixture', file: 'constructor', codecKind: 'json', content: '{"setting":true}' },
      ],
    }),
  ).toMatchObject({ checked: 1, gaps: [{ file: 'constructor', keys: ['setting'] }] });
});

it.each([
  null,
  { entries: [] },
  {
    updatedAt: 'fixture',
    entries: [{ project: 'x', file: '.npmrc', codecKind: 'npmrc', content: 42 }],
  },
  {
    updatedAt: 'fixture',
    entries: [{ project: 'x', file: '.npmrc', codecKind: 'unknown', content: '' }],
  },
])('rejects malformed snapshots: %j', (snapshot) => {
  expect(() => checkCoverage(snapshot)).toThrow(Error);
});

it('rejects repeated project/file entries instead of inflating inspected counts', () => {
  const entry = { project: 'fixture', file: '.npmrc', codecKind: 'npmrc', content: '' };
  expect(() => checkCoverage({ updatedAt: 'fixture', entries: [entry, entry] })).toThrow(
    'Duplicate snapshot entry',
  );
});

it.each([
  { formatVersion: '1' },
  { formatVersion: 2 },
  { projectCount: '1' },
  { projectCount: -1 },
  { projectCount: 0.5 },
  { projectCount: 2 },
])('rejects invalid or inconsistent snapshot metadata: %j', (metadata) => {
  expect(() =>
    checkCoverage({
      updatedAt: 'fixture',
      entries: [{ project: 'fixture', file: '.npmrc', codecKind: 'npmrc', content: '' }],
      ...metadata,
    }),
  ).toThrow(Error);
});
