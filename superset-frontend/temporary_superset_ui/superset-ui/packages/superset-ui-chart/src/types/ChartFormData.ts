/* eslint camelcase: 0 */
/* eslint-disable import/prefer-default-export */
// FormData uses snake_cased keys.
import { FormDataMetric, MetricKey } from './Metric';
import { AnnotationLayerMetadata } from './Annotation';

// Type signature and utility functions for formData shared by all viz types
// It will be gradually filled out as we build out the query object

// Define mapped type separately to work around a limitation of TypeScript
// https://github.com/Microsoft/TypeScript/issues/13573
// The Metrics in formData is either a string or a proper metric. It will be
// unified into a proper Metric type during buildQuery (see `/query/Metrics.ts`).
type Metrics = Partial<Record<MetricKey, FormDataMetric | FormDataMetric[]>>;

type BaseFormData = {
  datasource: string;
  viz_type: string;
  annotation_layers?: AnnotationLayerMetadata[];
  where?: string;
  groupby?: string[];
  columns?: string[];
  all_columns?: string[];
  limit?: number;
  row_limit?: number;
  order_desc?: boolean;
  timeseries_limit_metric?: FormDataMetric;
  time_range?: string;
  since?: string;
  until?: string;
} & Metrics;

// FormData is either sqla-based or druid-based
export type SqlaFormData = {
  granularity_sqla: string;
  time_grain_sqla?: string;
  having?: string;
} & BaseFormData;

export type DruidFormData = {
  granularity: string;
  having_druid?: string;
  druid_time_origin?: string;
} & BaseFormData;

export type ChartFormData = SqlaFormData | DruidFormData;
