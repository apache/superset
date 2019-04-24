/* eslint-disable sort-keys */
import { LINE_PLUGIN_TYPE, LINE_PLUGIN_LEGACY_TYPE } from '../constants';
import createQueryStory from '../../../../shared/components/createQueryStory';

export default [
  createQueryStory({
    choices: {
      'Line Chart - Legacy API': {
        chartType: LINE_PLUGIN_LEGACY_TYPE,
        formData: {
          datasource: '3__table',
          viz_type: 'line',
          url_params: {},
          granularity_sqla: 'ds',
          time_grain_sqla: 'P1D',
          time_range: '100 years ago : now',
          metrics: ['sum__num'],
          adhoc_filters: [],
          groupby: [],
          limit: 25,
          row_limit: 50000,
        },
      },
      'Line Chart - /api/v1/query': {
        chartType: LINE_PLUGIN_TYPE,
        formData: {
          viz_type: LINE_PLUGIN_TYPE,
          datasource: '3__table',
          url_params: {},
          granularity_sqla: 'ds',
          time_grain_sqla: 'P1D',
          time_range: '100 years ago : now',
          metrics: ['sum__num'],
          adhoc_filters: [],
          groupby: [],
          limit: 25,
          row_limit: 50000,
        },
      },
    },
    storyName: 'Queries',
    storyPath: 'preset-chart-xy|LineChartPlugin',
  }),
];
