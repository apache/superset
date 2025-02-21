/* eslint-disable camelcase */
// DODO was here
import { Maybe, QueryFormMetric } from '../../types';
import { Column } from './Column';

export type Aggregate =
  | 'AVG'
  | 'COUNT'
  | 'COUNT_DISTINCT'
  | 'MAX'
  | 'MIN'
  | 'SUM';

export interface AdhocMetricBase {
  hasCustomLabel?: boolean;
  label?: string;
  optionName?: string;
}

export interface AdhocMetricSimple extends AdhocMetricBase {
  expressionType: 'SIMPLE';
  column: Omit<Column, 'column_name'> & {
    column_name?: string;
    columnName?: string;
  };
  aggregate: Aggregate;
}

export interface AdhocMetricSQL extends AdhocMetricBase {
  expressionType: 'SQL';
  sqlExpression: string;
}

export type AdhocMetric = AdhocMetricSimple | AdhocMetricSQL;

/**
 * Select a predefined metric by its `metric_name`.
 */
export type SavedMetric = string;

/**
 * Metric definition stored in datasource metadata.
 */
interface MetricDodoExtended {
  description_ru?: Maybe<string>; // DODO added 44728892
  description_en?: Maybe<string>; // DODO added 44728892
}
export interface Metric extends MetricDodoExtended {
  id?: number;
  metric_name: string;
  expression?: Maybe<string>;
  certification_details?: Maybe<string>;
  certified_by?: Maybe<string>;
  d3format?: Maybe<string>;
  currency?: Maybe<string>;
  description?: Maybe<string>;
  is_certified?: boolean;
  verbose_name?: string;
  warning_markdown?: Maybe<string>;
  warning_text?: Maybe<string>;
  error_text?: string;
}

export function isSavedMetric(metric: any): metric is SavedMetric {
  return typeof metric === 'string';
}

export function isAdhocMetricSimple(metric: any): metric is AdhocMetricSimple {
  return typeof metric !== 'string' && metric?.expressionType === 'SIMPLE';
}

export function isAdhocMetricSQL(metric: any): metric is AdhocMetricSQL {
  return typeof metric !== 'string' && metric?.expressionType === 'SQL';
}

export function isQueryFormMetric(metric: any): metric is QueryFormMetric {
  return (
    isSavedMetric(metric) ||
    isAdhocMetricSimple(metric) ||
    isAdhocMetricSQL(metric)
  );
}

export default {};
