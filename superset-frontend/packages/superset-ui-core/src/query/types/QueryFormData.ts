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
import {
  QueryObject,
  QueryObjectExtras,
  QueryObjectFilterClause,
} from './Query';
import { TimeRange } from './Time';
import { TimeGranularity } from '../../time-format';
import { JsonObject } from '../../connection';
import { AdhocColumn, PhysicalColumn } from './Column';

/**
 * Metric definition/reference in query object.
 */
export type QueryFormMetric = SavedMetric | AdhocMetric;

/**
 * Column selects in query object (used as dimensions in both groupby or raw
 * query mode). Can be either reference to physical column or expression.
 */
export type QueryFormColumn = PhysicalColumn | AdhocColumn;

/**
 * Order query results by columns.
 * Format: [metric/column, is_ascending].
 */
export type QueryFormOrderBy =
  | [QueryFormColumn | QueryFormMetric | {}, boolean]
  | [];

export interface FormDataResidual {
  [key: string]: any;
}

export enum QueryMode {
  Aggregate = 'aggregate',
  Raw = 'raw',
}

/**
 * Query form fields related to SQL query and data outputs.
 */
export interface QueryFields {
  columns?: QueryFormColumn[];
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

/** These properties will be appended to those preexisting in the form data/query object */
export type ExtraFormDataAppend = {
  adhoc_filters?: AdhocFilter[];
  filters?: QueryObjectFilterClause[];
  /** These properties are for dynamic cross chart interaction */
  interactive_drilldown?: string[];
  interactive_groupby?: string[];
  interactive_highlight?: string[];
  /** This property can be used to pass non-standard form data between viz components */
  custom_form_data?: JsonObject;
};

/** These parameters override properties in the extras parameter in the form data/query object.
 * Not all keys of QueryObjectExtras are supported here to ensure that freeform where and having
 * filter clauses can't be overridden */
export type ExtraFormDataOverrideExtras = Pick<
  QueryObjectExtras,
  'relative_start' | 'relative_end' | 'time_grain_sqla'
>;

/** These parameters override those already present in the form data/query object */
export type ExtraFormDataOverrideRegular = Partial<
  Pick<SqlaFormData, 'granularity_sqla'>
> &
  Partial<Pick<SqlaFormData, 'granularity'>> &
  Partial<Pick<BaseFormData, 'time_range'>> &
  Partial<Pick<QueryObject, 'time_column' | 'time_grain'>>;

/** These parameters override those already present in the form data/query object */
export type ExtraFormDataOverride = ExtraFormDataOverrideRegular &
  ExtraFormDataOverrideExtras;

export type ExtraFormData = ExtraFormDataAppend & ExtraFormDataOverride;

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
  extra_form_data?: ExtraFormData;
  /** order descending */
  order_desc?: boolean;
  /** limit number of time series
   *  deprecated - use series_limit instead */
  limit?: number;
  /** limit number of row in the results */
  row_limit?: string | number | null;
  /** row offset for server side pagination */
  row_offset?: string | number | null;
  /** The metric used to order timeseries for limiting
   *  deprecated - use series_limit_metric instead */
  timeseries_limit_metric?: QueryFormMetric;
  /** Force refresh */
  force?: boolean;
  result_format?: string;
  result_type?: string;
  annotation_layers?: AnnotationLayer[];
  url_params?: Record<string, string>;
  custom_params?: Record<string, string>;
  /** limit number of series */
  series_columns?: QueryFormColumn[];
  series_limit?: number;
  series_limit_metric?: QueryFormMetric;
}

/**
 * Form data for SQLAlchemy based datasources.
 */
export interface SqlaFormData extends BaseFormData {
  /**
   * Name of the Time Column. Time column is optional.
   */
  granularity?: string;
  granularity_sqla?: string;
  time_grain_sqla?: TimeGranularity;
  having?: string;
}

export type QueryFormData = SqlaFormData;

//---------------------------------------------------
// Type guards
//---------------------------------------------------

export default {};
