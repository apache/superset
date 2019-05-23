/* eslint camelcase: 0 */
import { DatasourceType } from './Datasource';
import { ChartFormData } from './ChartFormData';
import { AdhocMetric } from './Metric';
import ChartProps from '../models/ChartProps';
import { BinaryOperator, SetOperator, UnaryOperator } from './Operator';
import { TimeRange } from './Time';

export type QueryObjectFilterClause = {
  col: string;
} & (
  | {
      op: BinaryOperator;
      val: string;
    }
  | {
      op: SetOperator;
      val: string[];
    }
  | {
      op: UnaryOperator;
    });

export type QueryObjectMetric = {
  label: string;
} & Partial<AdhocMetric>;

export type QueryObjectExtras = Partial<{
  /** HAVING condition for Druid */
  having_druid: string;
  druid_time_origin: string;
  /** HAVING condition for SQLAlchemy */
  having: string;
  time_grain_sqla: string;
  /** WHERE condition */
  where: string;
}>;

export type QueryObject = {
  /** Columns to group by */
  groupby?: string[];
  /** Metrics */
  metrics?: QueryObjectMetric[];

  extras?: QueryObjectExtras;

  /** Granularity (for steps in time series) */
  granularity: string;

  /** Free-form WHERE SQL: multiple clauses are concatenated by AND */
  where?: string;
  /** Free-form HAVING SQL, multiple clauses are concatenated by AND */
  having?: string;
  /** SIMPLE having filters */
  having_filters?: QueryObjectFilterClause[];
  /** SIMPLE where filters */
  filters?: QueryObjectFilterClause[];

  /** Maximum numbers of rows to return */
  row_limit?: number;
  /** Maximum number of series */
  timeseries_limit?: number;
  /** The metric used to sort the returned result. */
  timeseries_limit_metric?: QueryObjectMetric | null;

  orderby?: Array<[QueryObjectMetric, boolean]>;
  /** Direction to ordered by */
  order_desc?: boolean;

  /** If set, will group by timestamp */
  is_timeseries?: boolean;

  /** TODO: Doc */
  is_prequery?: boolean;
  /** TODO: Doc */
  prequeries?: string[];
} & TimeRange;

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

export type PreTransformProps = TransformFunction<ChartProps, ChartProps>;
export type TransformProps = TransformFunction<ChartProps>;
export type PostTransformProps = TransformFunction;

export type BuildQueryFunction<T extends ChartFormData> = (formData: T) => QueryContext;
