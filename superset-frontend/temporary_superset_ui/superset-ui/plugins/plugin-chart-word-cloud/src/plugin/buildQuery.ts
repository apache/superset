import { buildQueryContext } from '@superset-ui/core';
import { WordCloudFormData } from '../types';

export default function buildQuery(formData: WordCloudFormData) {
  // Set the single QueryObject's groupby field with series in formData
  const { metric, sort_by_metric } = formData;

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      ...(sort_by_metric && { orderby: [[metric, false]] }),
    },
  ]);
}
