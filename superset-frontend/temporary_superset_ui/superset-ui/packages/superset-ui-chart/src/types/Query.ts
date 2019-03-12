/* eslint camelcase: 0 */
import ChartProps from '../models/ChartProps';
import { DatasourceType } from './Datasource';
import { ChartFormData } from './ChartFormData';
import { Metric } from './Metric';

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

export type BuildQueryFunction<T extends ChartFormData> = (formData: T) => QueryContext;

export type TransformPropsFunction = (
  chartProps: ChartProps,
) => {
  [key: string]: any;
};
