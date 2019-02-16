import ChartProps from '../models/ChartProps';
import { DatasourceType } from './Datasource';
import { ChartFormData } from './ChartFormData';
import { Metric } from './Metric';

export interface QueryObject {
  granularity: string;
  groupby?: string[];
  metrics?: Metric[];
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
