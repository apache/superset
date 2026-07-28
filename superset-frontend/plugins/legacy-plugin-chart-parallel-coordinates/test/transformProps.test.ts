import { ChartProps } from '@superset-ui/core';
import transformProps from '../src/transformProps';

const createProps = () =>
  ({
    width: 800,
    height: 600,
    formData: {
      includeSeries: false,
      linearColorScheme: 'superset_seq_1',
      metrics: undefined,
      secondaryMetric: 'sum__SP_POP_TOTL',
      series: 'country_name',
      showDatatable: false,
    },
    queriesData: [{ data: [{ country_id: 'FRA', metric: 10 }] }],
    theme: {},
  }) as unknown as ChartProps;

test('do not crash on undefined metrics', () => {
  expect(() => transformProps(createProps())).not.toThrow();
});
