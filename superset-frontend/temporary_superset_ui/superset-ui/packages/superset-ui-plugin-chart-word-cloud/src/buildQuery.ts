import { buildQueryContext } from '@superset-ui/chart';
import WordCloudFormData from './WordCloudFormData';

export default function buildQuery(formData: WordCloudFormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      groupby: [formData.series],
    },
  ]);
}
