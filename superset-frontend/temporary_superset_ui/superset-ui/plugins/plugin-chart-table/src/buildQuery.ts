import { buildQueryContext, getMetricLabel, QueryMode, removeDuplicates } from '@superset-ui/core';
import { PostProcessingRule } from '@superset-ui/core/src/query/types/PostProcessing';
import { TableChartFormData } from './types';

export default function buildQuery(formData: TableChartFormData) {
  const {
    percent_metrics: percentMetrics,
    timeseries_limit_metric: timeseriesLimitMetric,
    query_mode: queryMode,
    order_desc: orderDesc,
  } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    let { metrics, orderby } = baseQueryObject;
    let postProcessing: PostProcessingRule[] = [];

    if (queryMode === QueryMode.aggregate) {
      // orverride orderby with timeseries metric when in aggregation mode
      if (timeseriesLimitMetric && orderDesc != null) {
        orderby = [[timeseriesLimitMetric, !orderDesc]];
      }
      // add postprocessing for percent metrics only when in aggregation mode
      if (percentMetrics && percentMetrics.length > 0) {
        const percentMetricLabels = percentMetrics.map(getMetricLabel);
        metrics = removeDuplicates(metrics.concat(percentMetrics), getMetricLabel);
        postProcessing = [
          {
            operation: 'contribution',
            options: {
              columns: percentMetricLabels,
              rename_columns: percentMetricLabels.map(x => `%${x}`),
            },
          },
        ];
      }
    }

    return [
      {
        ...baseQueryObject,
        orderby,
        metrics,
        post_processing: postProcessing,
      },
    ];
  });
}
