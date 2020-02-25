import { QueryFormData } from './types/QueryFormData';
import { QueryObjectMetric } from './types/Query';
import { MetricKey } from './types/Metric';
import convertMetric from './convertMetric';

export default function processMetrics(formData: QueryFormData) {
  // Use Array to maintain insertion order
  // for metrics that are order sensitive
  const metrics: QueryObjectMetric[] = [];

  Object.keys(MetricKey).forEach(key => {
    const metric = formData[MetricKey[key as keyof typeof MetricKey]];
    if (metric) {
      if (Array.isArray(metric)) {
        metric.forEach(m => {
          metrics.push(convertMetric(m));
        });
      } else {
        metrics.push(convertMetric(metric));
      }
    }
  });

  return metrics;
}
