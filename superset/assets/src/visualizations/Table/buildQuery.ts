import buildQueryContext from 'src/query';
import { Metrics, RawMetric } from 'src/query/Metric';
import FormData from './FormData';

export default function buildQuery(formData: FormData) {
  // Set the single QueryObject's groupby field with series in formData
  return buildQueryContext(formData, (baseQueryObject) => {
    const isTimeseries = formData.include_time;
    let columns:string[] = [];
    let groupby = baseQueryObject.groupby;
    let orderby:[RawMetric, boolean][] = [];
    const sortby = formData.timeseries_limit_metric;
    if (formData.all_columns && formData.all_columns.length > 0){
      columns = [...formData.all_columns];
      const orderByColumns = formData.order_by_cols || []
      orderByColumns.forEach((columnOrder) => {
        orderby.push(JSON.parse(columnOrder));
      });
      groupby = [];
    } else if (sortby) {
      orderby.push([sortby, !formData.order_desc]);
    }
    return [{
      ...baseQueryObject,
      columns,
      is_timeseries: isTimeseries,
      metrics: new TableMetrics(formData).getMetrics(),
      orderby,
      groupby,
    }];
  });
}

class TableMetrics extends Metrics {
  constructor(formData: FormData) {
    super(formData);
    if (formData.percent_metrics) {
      formData.percent_metrics.forEach((metric) => this.addMetricToList(metric));
    }
    if (formData.timeseries_limit_metric) {
      this.addMetricToList(formData.timeseries_limit_metric);
    }

  }

}

