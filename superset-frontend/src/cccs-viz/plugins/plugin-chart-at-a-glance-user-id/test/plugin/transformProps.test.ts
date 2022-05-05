import { AAGUserIDChartProps, AAGUserIDQueryFormData } from '../../src/types';
import transformProps from '../../src/plugin/transformProps';

describe('AtAGlance tranformProps', () => {
  const formData: AAGUserIDQueryFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    series: 'name',
    boldText: true,
    headerFontSize: 'xs',
    headerText: 'my text',
    emitFilter: false,
    viz_type: 'my_chart',
  };
  const chartProps = new AAGUserIDChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }],
      },
    ],
  });

  it('should tranform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual({
      width: 800,
      height: 600,
      boldText: true,
      headerFontSize: 'xs',
      headerText: 'my text',
      data: [
        { name: 'Hulk', sum__num: 1, __timestamp: new Date(599616000000) },
      ],
    });
  });
});
