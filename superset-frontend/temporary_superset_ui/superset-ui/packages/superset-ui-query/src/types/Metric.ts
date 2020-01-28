import { Column } from './Column';

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

export type Aggregate = 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MAX' | 'MIN' | 'SUM';

interface AdhocMetricSimple {
  expressionType: 'SIMPLE';
  column: Column;
  aggregate: Aggregate;
}

interface AdhocMetricSQL {
  expressionType: 'SQL';
  sqlExpression: string;
}

export type AdhocMetric = {
  label?: string;
  optionName?: string;
} & (AdhocMetricSimple | AdhocMetricSQL);
