import { buildQueryContext, ChartFormDataMetric, QueryObjectMetric } from '@superset-ui/chart';
import convertMetric from '@superset-ui/chart/lib/query/convertMetric';
import TableFormData from './TableFormData';

export default function buildQuery(formData: TableFormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData, baseQueryObject => {
    const isTimeseries = formData.include_time;
    let columns: string[] = [];
    let groupby = baseQueryObject.groupby;
    let orderby: [QueryObjectMetric, boolean][] = [];
    const sortby = formData.timeseries_limit_metric;
    if (formData.all_columns && formData.all_columns.length > 0) {
      columns = [...formData.all_columns];
      const orderByColumns = formData.order_by_cols || [];
      orderByColumns.forEach(columnOrder => {
        const parsedColumnOrder: [ChartFormDataMetric, boolean] = JSON.parse(columnOrder);
        orderby.push([convertMetric(parsedColumnOrder[0]), parsedColumnOrder[1]]);
      });
      groupby = [];
    } else if (sortby) {
      orderby.push([convertMetric(sortby), !formData.order_desc]);
    }
    return [
      {
        ...baseQueryObject,
        columns,
        is_timeseries: isTimeseries,
        orderby,
        groupby,
      },
    ];
  });
}
