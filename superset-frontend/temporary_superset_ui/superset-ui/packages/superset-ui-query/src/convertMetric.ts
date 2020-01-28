import { QueryFormDataMetric } from './types/QueryFormData';
import { QueryObjectMetric } from './types/Query';
import { AdhocMetric } from './types/Metric';

export const LABEL_MAX_LENGTH = 43;

function getDefaultLabel(metric: AdhocMetric) {
  let label: string;
  if (metric.expressionType === 'SIMPLE') {
    label = `${metric.aggregate}(${metric.column.columnName})`;
  } else {
    label = metric.sqlExpression;
  }

  return label.length <= LABEL_MAX_LENGTH
    ? label
    : `${label.slice(0, Math.max(0, LABEL_MAX_LENGTH - 3))}...`;
}

export default function convertMetric(metric: QueryFormDataMetric): QueryObjectMetric {
  let formattedMetric;
  if (typeof metric === 'string') {
    formattedMetric = {
      label: metric,
    };
  } else {
    // Note we further sanitize the metric label for BigQuery datasources
    // TODO: move this logic to the client once client has more info on the
    // the datasource
    const label = metric.label ?? getDefaultLabel(metric);
    formattedMetric = {
      ...metric,
      label,
    };
  }

  return formattedMetric;
}
