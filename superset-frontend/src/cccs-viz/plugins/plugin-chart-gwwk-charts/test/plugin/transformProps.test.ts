import { ChartProps } from '@superset-ui/core';
import transformProps from '../../src/Charts/transformProps';

describe('GwwkCharts tranformProps', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    series: 'name',
    boldText: true,
    headerFontSize: 'xs',
    headerText: 'my text',
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1 }],
      },
    ],
  });

  it('should transform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual({
      width: 800,
      height: 600,
      boldText: true,
      headerFontSize: 'xs',
      headerText: 'my text',
      data: [{ name: 'Hulk', sum__num: 1 }],
    });
  });
});
