import ChartProps from '../models/ChartProps';
import { DatasourceType } from './Datasource';
import { FormData } from './FormData';
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

export type BuildQueryFunction<T extends FormData> = (formData: T) => QueryContext;

export type TransformPropsFunction = (
  chartProps: ChartProps,
) => {
  [key: string]: any;
};
