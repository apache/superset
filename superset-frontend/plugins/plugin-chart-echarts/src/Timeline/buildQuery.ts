import {
  QueryFormData,
  QueryObject,
  buildQueryContext,
  ensureIsArray,
} from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  const {
    start_time,
    end_time,
    y_axis,
    series,
    tooltip_columns,
    tooltip_metrics,
    order_by_cols,
  } = formData;

  const groupBy = ensureIsArray(series);
  const orderby = ensureIsArray(order_by_cols).map(
    expr => JSON.parse(expr) as [string, boolean],
  );
  const columns = Array.from(
    new Set([
      start_time,
      end_time,
      y_axis,
      ...groupBy,
      ...ensureIsArray(tooltip_columns),
      ...orderby.map(v => v[0]),
    ]),
  );

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => [
    {
      ...baseQueryObject,
      columns,
      metrics: ensureIsArray(tooltip_metrics),
      orderby,
      series_columns: groupBy,
    },
  ]);
}
