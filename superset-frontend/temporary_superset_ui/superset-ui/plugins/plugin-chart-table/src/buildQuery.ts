import { buildQueryContext, getMetricLabel, removeDuplicates } from '@superset-ui/core';
import { PostProcessingRule } from '@superset-ui/core/src/query/types/PostProcessing';
import { TableChartFormData } from './types';

export default function buildQuery(formData: TableChartFormData) {
  const { percent_metrics: percentMetrics } = formData;
  return buildQueryContext(formData, baseQueryObject => {
    let { metrics } = baseQueryObject;
    let postProcessing: PostProcessingRule[] = [];
    if (percentMetrics) {
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
    return [
      {
        ...baseQueryObject,
        metrics,
        post_processing: postProcessing,
      },
    ];
  });
}
