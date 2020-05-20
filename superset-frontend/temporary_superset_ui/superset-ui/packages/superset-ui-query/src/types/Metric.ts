import { Column } from './Column';

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
