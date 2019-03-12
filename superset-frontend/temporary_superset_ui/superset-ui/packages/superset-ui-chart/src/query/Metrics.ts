import { ChartFormData } from '../types/ChartFormData';
import { MetricKey, Metric, FormDataMetric, AdhocMetric, ExpressionType } from '../types/Metric';

export const LABEL_MAX_LENGTH = 43;

export default class Metrics {
  // Use Array to maintain insertion order for metrics that are order sensitive
  private metrics: Metric[];

  constructor(formData: ChartFormData) {
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

  static formatMetric(metric: FormDataMetric): Metric {
    let formattedMetric;
    if (typeof metric === 'string') {
      formattedMetric = {
        label: metric,
      };
    } else {
      // Note we further sanitize the metric label for BigQuery datasources
      // TODO: move this logic to the client once client has more info on the
      // the datasource
      const label = metric.label || this.getDefaultLabel(metric);
      formattedMetric = {
        ...metric,
        label,
      };
    }

    return formattedMetric;
  }

  private addMetric(metric: FormDataMetric) {
    this.metrics.push(Metrics.formatMetric(metric));
  }

  static getDefaultLabel(metric: AdhocMetric) {
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
