import { Column } from './Column';
import { FormData } from './FormData';

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
  BUILTIN = 'BUILTIN',
  SIMPLE = 'SIMPLE',
  SQL = 'SQL',
}

interface SimpleMetric {
  expressionType: ExpressionType.SIMPLE;
  column: Column;
  aggregate: Aggregate;
  label?: string;
  optionName?: string;
}

interface SQLMetric {
  expressionType: ExpressionType.SQL;
  sqlExpression: string;
  label?: string;
  optionName?: string;
}

interface BuiltInMetric {
  expressionType: ExpressionType.BUILTIN;
  label: string;
}

// Type of metrics in form data
export type FormDataMetric = string | SQLMetric | SimpleMetric;

// Type of Metric the client provides to server after unifying various forms
// of metrics in form data
export type Metric = BuiltInMetric | SQLMetric | SimpleMetric;

export class Metrics {
  // Use Array to maintain insertion order for metrics that are order sensitive
  private metrics: Metric[];

  constructor(formData: FormData) {
    this.metrics = [];
    Object.keys(MetricKey).forEach(key => {
      const metric = formData[MetricKey[key as keyof typeof MetricKey]];
      if (metric) {
        if (Array.isArray(metric)) {
          metric.forEach(m => this.addMetric(m));
        } else {
          this.addMetric(metric);
        }
      }
    });
  }

  public getMetrics() {
    return this.metrics;
  }

  public getLabels() {
    return this.metrics.map(m => m.label);
  }

  private addMetric(metric: FormDataMetric) {
    if (typeof metric === 'string') {
      this.metrics.push({
        expressionType: ExpressionType.BUILTIN,
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

  private getDefaultLabel(metric: SQLMetric | SimpleMetric) {
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
