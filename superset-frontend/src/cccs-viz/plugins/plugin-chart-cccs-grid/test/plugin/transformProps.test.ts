import { CccsGridQueryFormData, CccsGridChartProps } from '../../src/types';
import { supersetTheme } from '@superset-ui/core';
import transformProps from '../../src/plugin/transformProps';

describe('CccsGrid tranformProps', () => {
  const formData: CccsGridQueryFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    series: 'name',
    boldText: true,
    headerFontSize: 'xs',
    headerText: 'my text',
    emitFilter: false,
    include_search: false,
    page_length: 0,
    enable_grouping: false,
    viz_type: 'my_chart',
    column_state: [],
  };
  const chartProps = new CccsGridChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
      },
    ],
    theme: supersetTheme,
  });

  it('should tranform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual({
      width: 800,
      height: 600,
      boldText: true,
      headerFontSize: 'xs',
      headerText: 'my text',
      include_search: false,
      data: [
        { name: 'Hulk', sum__num: 1, __timestamp: new Date(599616000000) },
      ],
    });
  });
});
