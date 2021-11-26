import { buildQueryContext } from '@superset-ui/core';
import { WordCloudFormData } from '../types';

export default function buildQuery(formData: WordCloudFormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
    },
  ]);
}
