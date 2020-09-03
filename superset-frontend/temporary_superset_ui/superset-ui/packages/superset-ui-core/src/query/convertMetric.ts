import { QueryFormResidualDataValue } from './types/QueryFormData';
import { QueryObjectMetric } from './types/Query';
import { AdhocMetric } from './types/Metric';

function getDefaultLabel(metric: AdhocMetric) {
  if (metric.expressionType === 'SIMPLE') {
    return `${metric.aggregate}(${metric.column.columnName})`;
  }
  return metric.sqlExpression;
}

export default function convertMetric(metric: QueryFormResidualDataValue): QueryObjectMetric {
  let formattedMetric;
  if (typeof metric === 'string') {
    formattedMetric = {
      label: metric,
    };
  } else {
    const label = metric.label ?? getDefaultLabel(metric);
    formattedMetric = {
      ...metric,
      label,
    };
  }

  return formattedMetric;
}
