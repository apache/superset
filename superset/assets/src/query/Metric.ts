import Column from './Column';
import FormData from './FormData';

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
  label?: string,
  optionName?: string,
} & (AdhocMetricSimple | AdhocMetricSQL);

type Metric = {
  label: string;
} & Partial<AdhocMetric>;

export default Metric;

export class Metrics {
  // Use Array to maintain insertion order for metrics that are order sensitive
  private metrics: Metric[];

  constructor(formData: FormData) {
    this.metrics = [];
    for (const key of Object.keys(MetricKey)) {
      const metric = formData[MetricKey[key] as MetricKey];
      if (metric) {
        if (typeof metric === 'string') {
          this.metrics.push({
            label: metric,
          });
        } else {
          // Note we further sanitize the metric label for BigQuery datasources
          // TODO: move this logic to the client once client has more info on the
          // the datasource
          const label = metric.label || this.getDefaultLabel(metric);
          this.metrics.push({
            ...metric,
            label,
          });
        }
      }
    }
  }

  public getMetrics() {
    return this.metrics;
  }

  public getLabels() {
    return this.metrics.map((m) => m.label);
  }

  private getDefaultLabel(metric: AdhocMetric) {
    let label: string;
    if (metric.expressionType === ExpressionType.SIMPLE) {
      label = `${metric.aggregate}(${(metric.column.columnName)})`;
    } else {
      label = metric.sqlExpression;
    }
    return label.length < 43 ? label : `${label.substring(0, 40)}...`;
  }
}
