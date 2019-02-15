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
} & Metrics;

// FormData is either sqla-based or druid-based
type SqlaFormData = {
  granularity_sqla: string;
} & BaseFormData;

type DruidFormData = {
  granularity: string;
} & BaseFormData;

export type FormData = SqlaFormData | DruidFormData;
