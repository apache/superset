import { Column } from './Column';
import FormData from './FormData';

export const LABEL_MAX_LENGTH = 43;

// Note that the values of MetricKeys are lower_snake_case because they're
// used as keys of form data jsons.
export enum MetricKey {
  METRIC = 'metric',
  METRICS = 'metrics',
  PERCENT_METRICS = 'percent_metrics',
  RIGHT_AXIS_METRIC = 'metric_2',
  SECONDARY_METRIC = 'secondary_metric',
  X = 'x',
  Y = 'y',
  SIZE = 'size',
}

export enum Aggregate {
  AVG = 'AVG',
  COUNT = 'COUNT ',
  COUNT_DISTINCT = 'COUNT_DISTINCT',
  MAX = 'MAX',
  MIN = 'MIN',
  SUM = 'SUM',
}

export enum ExpressionType {
  SIMPLE = 'SIMPLE',
  SQL = 'SQL',
}

interface AdhocMetricSimple {
  expressionType: ExpressionType.SIMPLE;
  column: Column;
  aggregate: Aggregate;
}

interface AdhocMetricSQL {
  expressionType: ExpressionType.SQL;
  sqlExpression: string;
}

export type AdhocMetric = {
  label?: string;
  optionName?: string;
} & (AdhocMetricSimple | AdhocMetricSQL);

export type Metric = {
  label: string;
} & Partial<AdhocMetric>;

export class Metrics {
  // Use Array to maintain insertion order for metrics that are order sensitive
  private metrics: Metric[];

  constructor(formData: FormData) {
    this.metrics = Object.keys(MetricKey)
      .map(key => formData[MetricKey[key as any] as MetricKey])
      .filter(metric => metric)
      .map(metric => {
        if (typeof metric === 'string') {
          return { label: metric };
        }

        // Note we further sanitize the metric label for BigQuery datasources
        // TODO: move this logic to the client once client has more info on the
        // the datasource
        return {
          ...metric,
          label: (metric as Metric).label || this.getDefaultLabel(metric as AdhocMetric),
        };
      });
  }

  public getMetrics() {
    return this.metrics;
  }

  public getLabels() {
    return this.metrics.map(m => m.label);
  }

  private getDefaultLabel(metric: AdhocMetric) {
    let label: string;
    if (metric.expressionType === ExpressionType.SIMPLE) {
      label = `${metric.aggregate}(${metric.column.columnName})`;
    } else {
      label = metric.sqlExpression;
    }

    return label.length <= LABEL_MAX_LENGTH
      ? label
      : `${label.substring(0, LABEL_MAX_LENGTH - 3)}...`;
  }
}
