import { buildQueryContext, QueryFormMetric } from '@superset-ui/core';
import TableFormData from './TableFormData';

export default function buildQuery(formData: TableFormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData, baseQueryObject => {
    const isTimeseries = formData.include_time;
    let columns: string[] = [];
    let { groupby } = baseQueryObject;
    const orderby: [QueryFormMetric, boolean][] = [];
    const sortby = formData.timeseries_limit_metric;
    if (formData.all_columns && formData.all_columns.length > 0) {
      columns = [...formData.all_columns];
      const orderByColumns = formData.order_by_cols || [];
      orderByColumns.forEach(columnOrder => {
        const parsedColumnOrder: [QueryFormMetric, boolean] = JSON.parse(columnOrder);
        orderby.push([parsedColumnOrder[0], parsedColumnOrder[1]]);
      });
      groupby = [];
    } else if (sortby) {
      orderby.push([sortby, !formData.order_desc]);
    }

    return [
      {
        ...baseQueryObject,
        columns,
        groupby,
        is_timeseries: isTimeseries,
        orderby,
      },
    ];
  });
}
