/* eslint camelcase: 0 */
// FormData uses snake_cased keys.
import { FormDataMetric, MetricKey } from './Metric';

// Type signature and utility functions for formData shared by all viz types
// It will be gradually filled out as we build out the query object

// Define mapped type separately to work around a limitation of TypeScript
// https://github.com/Microsoft/TypeScript/issues/13573
// The Metrics in formData is either a string or a proper metric. It will be
// unified into a proper Metric type during buildQuery (see `/query/Metrics.ts`).
type Metrics = Partial<Record<MetricKey, FormDataMetric | FormDataMetric[]>>;

export type AnnotationLayerMetadata = {
  name: string;
  sourceType?: string;
};

type BaseFormData = {
  datasource: string;
  viz_type: string;
  annotation_layers?: Array<AnnotationLayerMetadata>;
} & Metrics;

// FormData is either sqla-based or druid-based
type SqlaFormData = {
  granularity_sqla: string;
} & BaseFormData;

type DruidFormData = {
  granularity: string;
} & BaseFormData;

export type FormData = SqlaFormData | DruidFormData;

export function getGranularity(formData: FormData): string {
  return 'granularity_sqla' in formData ? formData.granularity_sqla : formData.granularity;
}
