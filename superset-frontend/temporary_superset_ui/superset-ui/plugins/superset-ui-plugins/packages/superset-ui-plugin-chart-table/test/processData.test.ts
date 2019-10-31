import getProcessDataFunction from '../src/processData';

describe('processData', () => {
  const processData = getProcessDataFunction();
  const timeseriesLimitMetric = 'a';
  const orderDesc = true;
  const records = [
    {
      a: 1,
      b: 1,
      c: 3,
    },
    {
      a: 2,
      b: 1,
      c: 2,
    },
    {
      a: 3,
      b: 1,
      c: 1,
    },
  ];
  const metrics = ['a', 'b', 'c'];

  it('returns sorted result', () => {
    const result = processData({
      timeseriesLimitMetric,
      orderDesc,
      records,
      metrics,
    });
    const maxValue = Math.max(...records.map(r => r[timeseriesLimitMetric]));
    const minValue = Math.min(...records.map(r => r[timeseriesLimitMetric]));
    expect(result[0].data[timeseriesLimitMetric]).toEqual(maxValue);
    expect(result[result.length - 1].data[timeseriesLimitMetric]).toEqual(minValue);
  });

  it('removes the timeseriesLimitMetric column if it is not included in metrics', () => {
    const filteredMetrics = metrics.filter(metric => metric !== timeseriesLimitMetric);
    const result = processData({
      timeseriesLimitMetric,
      orderDesc,
      records,
      metrics: filteredMetrics,
    });
    result.forEach(row => {
      expect(row.data).toEqual(
        expect.not.objectContaining({
          [timeseriesLimitMetric]: expect(Number),
        }),
      );
    });
  });
});
