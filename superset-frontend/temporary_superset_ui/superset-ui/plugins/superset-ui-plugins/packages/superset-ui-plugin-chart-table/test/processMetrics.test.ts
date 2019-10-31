import getProcessMetricsFunction from '../src/processMetrics';

describe('processData', () => {
  const processMetrics = getProcessMetricsFunction();
  const records = [
    {
      a: 1,
      '%b': 0.4,
      c: 3,
    },
    {
      a: 2,
      '%b': 0.4,
      c: 2,
    },
    {
      a: 3,
      '%b': 0.2,
      c: 1,
    },
  ];
  const metrics = ['a'];
  const percentMetrics = ['b'];

  it('returns sorted result', () => {
    const result = processMetrics({
      records,
      metrics,
      percentMetrics,
    });
    const expected = ['a', '%b'];
    expect(result).toEqual(expect.arrayContaining(expected));
  });
});
