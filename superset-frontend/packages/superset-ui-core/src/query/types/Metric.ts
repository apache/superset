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
import { Maybe } from '../../types';
import { Column } from './Column';

export type Aggregate = 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MAX' | 'MIN' | 'SUM';

export interface AdhocMetricBase {
  label?: string;
  optionName?: string;
}

export interface AdhocMetricSimple extends AdhocMetricBase {
  expressionType: 'SIMPLE';
  column: Omit<Column, 'column_name'> & {
    column_name?: string;
    columnName?: string;
  };
  aggregate: Aggregate;
}

export interface AdhocMetricSQL extends AdhocMetricBase {
  expressionType: 'SQL';
  sqlExpression: string;
}

export type AdhocMetric = AdhocMetricSimple | AdhocMetricSQL;

/**
 * Select a predefined metric by its `metric_name`.
 */
export type SavedMetric = string;

/**
 * Metric definition stored in datasource metadata.
 */
export interface Metric {
  id?: number;
  metric_name: string;
  expression?: Maybe<string>;
  certification_details?: Maybe<string>;
  certified_by?: Maybe<string>;
  d3format?: Maybe<string>;
  description?: Maybe<string>;
  is_certified?: boolean;
  verbose_name?: string;
  warning_markdown?: Maybe<string>;
  warning_text?: Maybe<string>;
}

export default {};
