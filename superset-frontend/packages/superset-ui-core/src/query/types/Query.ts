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
import {
  QueryFields,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
} from './QueryFormData';
import { Maybe } from '../../types';
import { PostProcessingRule } from './PostProcessing';
import { JsonObject } from '../../connection';
import { TimeGranularity } from '../../time-format';

export type QueryObjectFilterClause = {
  col: QueryFormColumn;
  grain?: TimeGranularity;
  isExtra?: boolean;
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
  time_grain_sqla?: TimeGranularity;
  /** WHERE condition */
  where?: string;
}>;

export type ResidualQueryObjectData = {
  [key: string]: unknown;
};

/**
 * Query object directly compatible with the new chart data API.
 * A stricter version of query form data.
 *
 * All information should be related to generating database queries. Config values
 * for client-side processing and chart rendering should happen in `buildQuery`
 * and `transformProps`.
 */
export interface QueryObject
  extends QueryFields,
    TimeRange,
    ResidualQueryObjectData {
  /**
   * Definition for annotation layers.
   */
  annotation_layers?: AnnotationLayer[];

  /** Time filters that have been applied to the query object */
  applied_time_extras?: AppliedTimeExtras;

  /** add fetch value predicate to query if defined in datasource */
  apply_fetch_values_predicate?: boolean;

  /**
   * Extra form data. Current stores information about time granularity, may be
   * cleaned up in the future.
   */
  extras?: QueryObjectExtras;

  /** SIMPLE where filters */
  filters?: QueryObjectFilterClause[];

  /** Time column for SQL, time-grain for Druid (deprecated) */
  granularity?: string;

  /** If set, will group by timestamp */
  is_timeseries?: boolean;

  /** Should the rowcount of the query be fetched */
  is_rowcount?: boolean;

  /** Free-form HAVING SQL, multiple clauses are concatenated by AND */
  having?: string;

  /** SIMPLE having filters */
  having_filters?: QueryObjectFilterClause[];

  post_processing?: (PostProcessingRule | undefined)[];

  /** Maximum numbers of rows to return */
  row_limit?: number;

  /** Number of rows to skip */
  row_offset?: number;

  /** The column to which direct temporal filters (forthcoming) */
  time_column?: string;

  /** The size of bucket by which to group timeseries data (forthcoming) */
  time_grain?: string;

  /** Maximum number of timeseries */
  timeseries_limit?: number;

  /** The metric used to sort the returned result. */
  timeseries_limit_metric?: Maybe<QueryFormMetric>;

  /** Direction to ordered by */
  order_desc?: boolean;

  url_params?: Record<string, string>;

  custom_params?: JsonObject;

  /** Free-form WHERE SQL: multiple clauses are concatenated by AND */
  where?: string;

  /** Limit number of series */
  series_columns?: QueryFormColumn[];
  series_limit?: number;
  series_limit_metric?: Maybe<QueryFormMetric>;
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
  form_data?: QueryFormData;
}

export default {};
