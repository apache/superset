// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

/* eslint-disable camelcase */

// Basic types for form data and query objects
export interface JsonObject {
  [key: string]: any;
}

// Metric types
export interface SavedMetric {
  metric_name: string;
  expression?: string;
  label?: string;
}

export interface AdhocMetric {
  aggregate: string;
  column?: any;
  expressionType: 'SIMPLE' | 'SQL';
  hasCustomLabel?: boolean;
  label: string;
  sqlExpression?: string;
  optionName?: string;
}

export type QueryFormMetric = SavedMetric | AdhocMetric | string;

// Column types  
export interface PhysicalColumn {
  column_name: string;
  type?: string;
}

export interface AdhocColumn {
  hasCustomLabel?: boolean;
  label: string;
  sqlExpression: string;
  expressionType: 'SQL';
  optionName?: string;
}

export type QueryFormColumn = PhysicalColumn | AdhocColumn | string;

// Filter types
export type BinaryOperator = 
  | '==' | '!=' | '>' | '<' | '>=' | '<=' 
  | 'LIKE' | 'ILIKE' | 'REGEX' | 'NOT REGEX';

export type SetOperator = 'IN' | 'NOT IN';

export interface AdhocFilter {
  clause: 'WHERE' | 'HAVING';
  comparator?: any;
  expressionType: 'SIMPLE' | 'SQL';
  operator?: BinaryOperator | SetOperator;
  subject?: string | AdhocColumn;
  sqlExpression?: string;
  filterOptionName?: string;
}

export interface QueryObjectFilterClause {
  col: string;
  op: BinaryOperator | SetOperator;
  val: any;
}

// Order by types
export type QueryFormOrderBy = [QueryFormColumn | QueryFormMetric | {}, boolean] | [];

// Annotation types
export interface AnnotationLayer {
  annotationType: string;
  name: string;
  show: boolean;
  sourceType?: string;
  value?: string;
  [key: string]: any;
}

// Time range types
export interface TimeRange {
  time_range?: string;
  since?: string;
  until?: string;
}

// Extra form data types
export interface ExtraFormDataAppend {
  adhoc_filters?: AdhocFilter[];
  filters?: QueryObjectFilterClause[];
  interactive_drilldown?: string[];
  interactive_groupby?: string[];
  interactive_highlight?: string[];
  custom_form_data?: JsonObject;
}

export interface ExtraFormDataOverride {
  granularity_sqla?: string;
  granularity?: string;
  time_range?: string;
  time_column?: string;
  time_grain?: string;
  time_compare?: string[];
  relative_start?: string;
  relative_end?: string;
  time_grain_sqla?: string;
}

export type ExtraFormData = ExtraFormDataAppend & ExtraFormDataOverride;

// Query extras interface
export interface QueryObjectExtras {
  having?: string;
  where?: string;
  time_grain_sqla?: string;
  time_range_endpoints?: [string, string];
  relative_start?: string;
  relative_end?: string;
  time_compare?: string[];
  [key: string]: any;
}

// Main form data interface
export interface BaseFormData extends TimeRange {
  datasource: string;
  viz_type: string;
  metrics?: QueryFormMetric[];
  where?: string;
  columns?: QueryFormColumn[];
  groupby?: QueryFormColumn[];
  all_columns?: QueryFormColumn[];
  adhoc_filters?: AdhocFilter[] | null;
  extra_form_data?: ExtraFormData;
  order_desc?: boolean;
  limit?: number;
  row_limit?: string | number | null;
  row_offset?: string | number | null;
  series_columns?: QueryFormColumn[];
  series_limit?: number;
  series_limit_metric?: QueryFormMetric;
  annotation_layers?: AnnotationLayer[];
  url_params?: Record<string, string>;
  custom_params?: Record<string, string>;
  [key: string]: any;
}

export interface SqlaFormData extends BaseFormData {
  granularity?: string;
  granularity_sqla?: string;
  time_grain_sqla?: string;
  having?: string;
}

export type QueryFormData = SqlaFormData;

// Query object interface
export interface QueryObject {
  time_range?: string;
  since?: string;
  until?: string;
  granularity?: string;
  columns?: QueryFormColumn[];
  metrics?: QueryFormMetric[];
  orderby?: QueryFormOrderBy[];
  annotation_layers?: AnnotationLayer[];
  row_limit?: number;
  row_offset?: number;
  series_columns?: QueryFormColumn[];
  series_limit?: number;
  series_limit_metric?: QueryFormMetric;
  group_others_when_limit_reached?: boolean;
  order_desc?: boolean;
  url_params?: Record<string, string>;
  custom_params?: Record<string, string>;
  extras?: QueryObjectExtras;
  filters?: QueryObjectFilterClause[];
  custom_form_data?: JsonObject;
}

// Query field aliases
export type QueryFieldAliases = {
  [key: string]: 'metrics' | 'columns' | 'groupby';
};

// Utility functions
export function isAdhocMetric(metric: any): metric is AdhocMetric {
  return metric && typeof metric === 'object' && 'expressionType' in metric;
}

export function isQueryFormMetric(metric: any): metric is QueryFormMetric {
  return typeof metric === 'string' || isAdhocMetric(metric) || 
    (metric && typeof metric === 'object' && 'metric_name' in metric);
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}