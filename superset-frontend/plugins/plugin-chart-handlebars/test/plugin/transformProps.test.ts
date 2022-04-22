import { ChartProps, QueryFormData } from '@superset-ui/core';
import { HandlebarsQueryFormData } from '../../src/types';
import transformProps from '../../src/plugin/transformProps';

describe('Handlebars tranformProps', () => {
  const formData: HandlebarsQueryFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularitySqla: 'ds',
    metric: 'sum__num',
    groupby: ['name'],
    width: 500,
    height: 500,
    viz_type: 'handlebars',
  };
  const chartProps = new ChartProps<QueryFormData>({
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
      formData,
      width: 800,
      height: 600,
      data: [
        { name: 'Hulk', sum__num: 1, __timestamp: new Date(599616000000) },
      ],
    });
  });
});
