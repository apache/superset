/* eslint camelcase: 0 */
import { DatasourceType } from './Datasource';
import { ChartFormData } from './ChartFormData';
import { Metric } from './Metric';
import ChartProps from '../models/ChartProps';

export interface QueryObject {
  granularity: string;
  groupby?: string[];
  metrics?: Metric[];
  extras?: {
    [key: string]: string;
  };
  timeseries_limit?: number;
  timeseries_limit_metric?: Metric | null;
  time_range?: string;
  since?: string;
  until?: string;
  row_limit?: number;
  order_desc?: boolean;
  is_timeseries?: boolean;
  prequeries?: string[];
  is_prequery?: boolean;
  orderby?: Array<[Metric, boolean]>;
}

export interface QueryContext {
  datasource: {
    id: number;
    type: DatasourceType;
  };
  queries: QueryObject[];
}

export interface PlainProps {
  [key: string]: any;
}

type TransformFunction<Input = PlainProps, Output = PlainProps> = (x: Input) => Output;

export type PreTransformProps = TransformFunction<ChartProps>;
export type TransformProps = TransformFunction;
export type PostTransformProps = TransformFunction;

export type BuildQueryFunction<T extends ChartFormData> = (formData: T) => QueryContext;
