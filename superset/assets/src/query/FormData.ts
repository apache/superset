import { MetricKey, MetricsKey, RawMetric } from './Metric';

// Type signature and utility functions for formData shared by all viz types
// It will be gradually filled out as we build out the query object

// Define mapped type separately to work around a limitation of TypeScript
// https://github.com/Microsoft/TypeScript/issues/13573
// The Metrics in formData is either a string or a proper metric. It will be
// unified into a proper Metric type during buildQuery (see `/query/Metrics.ts`).

type Metrics = Partial<Record<MetricKey, RawMetric>>;
type MetricsArray = Partial<Record<MetricsKey, RawMetric[]>>;

type BaseFormData = {
  datasource: string;
  where?: string;
  groupby?: string[];
  columns?: string[];
  all_columns?: string[];
  limit?: string;
  row_limit: string;
  order_desc: boolean;
  timeseries_limit_metric: RawMetric;
  time_range: string;
  since: string;
  until: string;
} & Metrics & MetricsArray;

// FormData is either sqla-based or druid-based
type SqlaFormData = {
  granularity_sqla: string;
  time_grain_sqla?: string;
  having?: string;
} & BaseFormData;

type DruidFormData = {
  granularity: string;
  having_druid?: string;
  druid_time_origin?: string;
} & BaseFormData;

type FormData =  BaseFormData & SqlaFormData & DruidFormData;
export default FormData;

export function getGranularity(formData: FormData): string {
  return 'granularity_sqla' in formData ? formData.granularity_sqla : formData.granularity;
}
