/* eslint camelcase: 0 */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { DatasourceType } from './Datasource';
import { BinaryOperator, SetOperator, UnaryOperator } from './Operator';
import { AppliedTimeExtras, TimeRange } from './Time';
import { AnnotationLayer } from './AnnotationLayer';
import { QueryFields, QueryFormMetric } from './QueryFormData';
import { Maybe } from '../../types';

export type QueryObjectFilterClause = {
  col: string;
} & (
  | {
      op: BinaryOperator;
      val: string | number | boolean;
    }
  | {
      op: SetOperator;
      val: (string | number | boolean)[];
    }
  | {
      op: UnaryOperator;
    }
);

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

/**
 * Query object directly compatible with the new chart data API.
 * A slightly more strict version of query form data.
 */
export interface QueryObject extends QueryFields, TimeRange, ResidualQueryObjectData {
  metrics: QueryFormMetric[];

  annotation_layers?: AnnotationLayer[];
  /** Time filters that have been applied to the query object */
  applied_time_extras?: AppliedTimeExtras;

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
  timeseries_limit_metric?: Maybe<QueryFormMetric>;

  orderby?: Array<[QueryFormMetric, boolean]>;
  /** Direction to ordered by */
  order_desc?: boolean;

  /** If set, will group by timestamp */
  is_timeseries?: boolean;
  url_params?: Record<string, string>;
}

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
