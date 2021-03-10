import { QueryFormMetric } from './types/QueryFormData';

export default function getMetricLabel(metric: QueryFormMetric) {
  if (typeof metric === 'string') {
    return metric;
  }
  if (metric.label) {
    return metric.label;
  }
  if (metric.expressionType === 'SIMPLE') {
    return `${metric.aggregate}(${metric.column.columnName || metric.column.column_name})`;
  }
  return metric.sqlExpression;
}
