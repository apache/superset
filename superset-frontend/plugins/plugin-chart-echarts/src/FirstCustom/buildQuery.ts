import { buildQueryContext } from '@superset-ui/core';

export default function buildQuery(formData: any) {
  const { metric, groupby } = formData;
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      metrics: [metric],
      groupby,
    },
  ]);
}
