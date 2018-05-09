import { sliceId as id } from './mockChartQueries';
import { datasourceId } from './mockDatasource';

export const sliceId = id;

export default {
  slices: {
    [sliceId]: {
      slice_id: sliceId,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%2018%7D',
      slice_name: 'Genders',
      form_data: {
        slice_id: sliceId,
        viz_type: 'pie',
        row_limit: 50000,
        metric: 'sum__num',
        since: '100 years ago',
        groupby: ['gender'],
        metrics: ['sum__num'],
        compare_lag: '10',
        limit: '25',
        until: 'now',
        granularity: 'ds',
        markup_type: 'markdown',
        where: '',
        compare_suffix: 'o10Y',
        datasource: datasourceId,
      },
      edit_url: `/slicemodelview/edit/${sliceId}`,
      viz_type: 'pie',
      datasource: datasourceId,
      description: null,
      description_markeddown: '',
    },
  },
  isLoading: false,
  errorMessage: null,
  lastUpdated: 0,
};
