import { QueryFormData } from '@superset-ui/core';
import { MyCustomChartFormData } from './types';

export function buildQuery(formData: MyCustomChartFormData): QueryFormData {
  const { datasource, groupby, metric, showLabels } = formData;

  const query: QueryFormData = {
    datasource,
    viz_type: 'my_custom_chart',
    groupby: groupby.length > 0 ? groupby : undefined,
    metrics: metric ? [metric] : undefined,
    filters: [],
    time_range: '',
    showLabels,
  };
  return query;
}
