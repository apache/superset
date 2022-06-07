import {
  DatasourceType,
  DEFAULT_METRICS,
  QueryResponse,
  testQuery,
} from '@superset-ui/core';
import { defineSavedMetrics } from '@superset-ui/chart-controls';

describe('defineSavedMetrics', () => {
  it('defines saved metrics if source is a Dataset', () => {
    expect(
      defineSavedMetrics({
        id: 1,
        metrics: [
          {
            metric_name: 'COUNT(*) non-default-dataset-metric',
            expression: 'COUNT(*) non-default-dataset-metric',
          },
        ],
        type: DatasourceType.Table,
        main_dttm_col: 'test',
        time_grain_sqla: 'P1D',
        columns: [
          {
            column_name: 'fiz',
          },
          {
            column_name: 'about',
            verbose_name: 'right',
          },
          {
            column_name: 'foo',
            verbose_name: 'bar',
          },
        ],
        verbose_map: {},
        column_format: { fiz: 'NUMERIC', about: 'STRING', foo: 'DATE' },
        datasource_name: 'my_datasource',
        description: 'this is my datasource',
      }),
    ).toEqual([
      {
        metric_name: 'COUNT(*) non-default-dataset-metric',
        expression: 'COUNT(*) non-default-dataset-metric',
      },
    ]);
  });

  it('returns default saved metrics if souce is a Query', () => {
    expect(defineSavedMetrics(testQuery as QueryResponse)).toEqual(
      DEFAULT_METRICS,
    );
  });
});
