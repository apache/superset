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

// Type of metrics in form data
export type FormDataMetric = string | AdhocMetric;

// Type of Metric the client provides to server after unifying various forms
// of metrics in form data
export type Metric = {
  label: string;
} & Partial<AdhocMetric>;
