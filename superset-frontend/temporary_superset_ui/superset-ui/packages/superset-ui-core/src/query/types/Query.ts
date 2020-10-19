/* eslint camelcase: 0 */
import { DatasourceType } from './Datasource';
import { AdhocMetric } from './Metric';
import { BinaryOperator, SetOperator, UnaryOperator } from './Operator';
import { AppliedTimeExtras, TimeRange } from './Time';
import { QueryFormDataMetric, QueryFormResidualDataValue } from './QueryFormData';

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
    }
);

export type QueryObjectMetric = {
  label: string;
  metric_name?: string;
  d3format?: string;
} & Partial<AdhocMetric>;

export type QueryObjectExtras = Partial<{
  /** HAVING condition for Druid */
  having_druid?: string;
  druid_time_origin?: string;
  /** HAVING condition for SQLAlchemy */
  having?: string;
  relative_start?: string;
  relative_end?: string;
  time_grain_sqla?: string;
  time_range_endpoints?: string[];
  /** WHERE condition */
  where?: string;
}>;

export type ResidualQueryObjectData = {
  [key: string]: unknown;
};

export type QueryObject = {
  /** Time filters that have been applied to the query object */
  applied_time_extras?: AppliedTimeExtras;
  /** Columns to group by */
  groupby?: string[];
  /** Metrics */
  metrics?: QueryObjectMetric[];

  extras?: QueryObjectExtras;

  /** Granularity (for steps in time series) */
  granularity?: string;

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
  /** Number of rows to skip */
  row_offset?: number;
  /** Maximum number of series */
  timeseries_limit?: number;
  /** The metric used to sort the returned result. */
  timeseries_limit_metric?: QueryObjectMetric | null;

  orderby?: Array<[QueryObjectMetric, boolean]>;
  /** Direction to ordered by */
  order_desc?: boolean;

  /** If set, will group by timestamp */
  is_timeseries?: boolean;
} & TimeRange &
  ResidualQueryObjectData;

export interface QueryContext {
  datasource: {
    id: number;
    type: DatasourceType;
  };
  /** Force refresh of all queries */
  force: boolean;
  /** Type of result to return for queries */
  result_type: string;
  /** Response format */
  result_format: string;
  queries: QueryObject[];
}

export type QueryFieldData = {
  columns: QueryFormResidualDataValue[];
  groupby: QueryFormResidualDataValue[];
  metrics: QueryFormDataMetric[];
  [key: string]: QueryFormResidualDataValue[];
};
