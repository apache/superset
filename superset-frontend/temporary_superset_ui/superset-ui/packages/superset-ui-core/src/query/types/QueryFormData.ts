/* eslint-disable camelcase */
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

/**
 * Types for the final QueryContext sent to /api/v1/chart/data.
 */
import { AdhocMetric, SavedMetric } from './Metric';
import { AdhocFilter } from './Filter';
import { BinaryOperator, SetOperator } from './Operator';
import { AnnotationLayer } from './AnnotationLayer';
import { QueryObject } from './Query';
import { TimeRange, TimeRangeEndpoints } from './Time';
import { TimeGranularity } from '../../time-format';
import { JsonObject } from '../../connection';

/**
 * Metric definition/reference in query object.
 */
export type QueryFormMetric = SavedMetric | AdhocMetric;

/**
 * Column selects in query object (used as dimensions in both groupby or raw
 * query mode). Only support referring existing columns.
 */
export type QueryFormColumn = string;

/**
 * Order query results by columns.
 * Format: [metric/column, is_ascending].
 */
export type QueryFormOrderBy = [QueryFormColumn | QueryFormMetric, boolean];

export interface FormDataResidual {
  [key: string]: any;
}

export enum QueryMode {
  aggregate = 'aggregate',
  raw = 'raw',
}

/**
 * Query form fields related to SQL query and data outputs.
 */
export interface QueryFields {
  columns: QueryFormColumn[];
  metrics?: QueryFormMetric[];
  orderby?: QueryFormOrderBy[];
}

/**
 * Name of query fields.
 */
export type QueryField = keyof QueryFields;

/**
 * Map of arbitrary control field names to query field names
 * (one of 'metrics' | 'columns' | 'groupby').
 *
 * Note that `groupby` is only added here because it is will be handled when
 * processing aliases but will not be sent to final objects. See `extraQueryFields.ts`.
 */
export type QueryFieldAliases = {
  [key: string]: QueryField | 'groupby';
};

/**
 * Filter value for adhoc filters from dashboard FilterBox.
 * Currently only Binary and Set filters are supported.
 */
export type QueryFormExtraFilter = {
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
);

export type ExtraFormData = {
  /** params that will be passed to buildQuery and will be appended to request params */
  append_form_data?: Partial<QueryObject>;
  /** params that will be passed to buildQuery and will override request params with same name */
  override_form_data?: Partial<QueryObject>;
  /** custom params that will be passed to buildQuery and can be used for request customization */
  custom_form_data?: JsonObject;
};

// Type signature for formData shared by all viz types
// It will be gradually filled out as we build out the query object

export interface BaseFormData extends TimeRange, FormDataResidual {
  /** datasource identifier ${id}_${type} */
  datasource: string;
  /**
   * visualization type
   * - necessary if you use the plugin and want to use
   * buildQuery function from the plugin.
   * This must match the key used when registering the plugin.
   * - not necessary if you do not plan to use the
   * buildQuery function from the plugin.
   * Can put "custom" (or any string) in this field in that case.
   */
  viz_type: string;
  metrics?: QueryFormMetric[];
  where?: string;
  columns?: QueryFormColumn[];
  groupby?: QueryFormColumn[];
  all_columns?: QueryFormColumn[];
  /** list of filters */
  adhoc_filters?: AdhocFilter[] | null;
  extra_filters?: QueryFormExtraFilter[] | null;
  /** order descending */
  order_desc?: boolean;
  /** limit number of time series */
  limit?: number;
  /** limit number of row in the results */
  row_limit?: string | number | null;
  /** row offset for server side pagination */
  row_offset?: string | number | null;
  /** The metric used to order timeseries for limiting */
  timeseries_limit_metric?: QueryFormColumn;
  /** Force refresh */
  force?: boolean;
  result_format?: string;
  result_type?: string;
  time_range_endpoints?: TimeRangeEndpoints;
  annotation_layers?: AnnotationLayer[];
  url_params?: Record<string, string>;
  custom_params?: Record<string, string>;
  extra_jwt?: string;
}

/**
 * Form data for SQLAlchemy based datasources.
 */
export interface SqlaFormData extends BaseFormData {
  /**
   * Name of the Time Column. Time column is optional.
   */
  granularity_sqla?: string;
  time_grain_sqla?: TimeGranularity;
  having?: string;
}

/**
 * Form data for Druid datasources.
 */
export interface DruidFormData extends BaseFormData {
  granularity: string;
  having_druid?: string;
  druid_time_origin?: string;
}

export type QueryFormData = DruidFormData | SqlaFormData;

//---------------------------------------------------
// Type guards
//---------------------------------------------------

export function isDruidFormData(formData: QueryFormData): formData is DruidFormData {
  return 'granularity' in formData;
}

export default {};
