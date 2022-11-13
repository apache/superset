import { buildQueryContext, QueryFormData } from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const columns = [formData.entity];
  if (formData.series) columns.push(formData.series);

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      row_limit: formData.limit,
    },
  ]);
}
