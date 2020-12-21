import { buildQueryContext, QueryFormData } from '@superset-ui/core';
import { TableChartFormData } from './types';

export default function buildQuery(formData: TableChartFormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData as QueryFormData, baseQueryObject => {
    return [
      {
        ...baseQueryObject,
      },
    ];
  });
}
