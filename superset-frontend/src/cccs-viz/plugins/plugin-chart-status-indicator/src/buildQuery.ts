import { buildQueryContext } from '@superset-ui/core';
import { FormData } from './types';

export default function buildQuery(formData: FormData) {
  const { metrics, order_desc } = formData;

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      orderby: metrics.map(metric => [metric, order_desc]),
    },
  ]);
}
