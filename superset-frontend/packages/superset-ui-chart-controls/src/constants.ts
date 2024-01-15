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
import {
  DTTM_ALIAS,
  GenericDataType,
  QueryColumn,
  QueryMode,
  t,
} from '@superset-ui/core';
import { ColumnMeta, SortSeriesData, SortSeriesType } from './types';

export const DEFAULT_MAX_ROW = 100000;

// eslint-disable-next-line import/prefer-default-export
export const TIME_FILTER_LABELS = {
  time_range: t('Time Range'),
  granularity_sqla: t('Time Column'),
  time_grain_sqla: t('Time Grain'),
  granularity: t('Time Granularity'),
};

export const COLUMN_NAME_ALIASES: Record<string, string> = {
  [DTTM_ALIAS]: t('Time'),
};

export const DATASET_TIME_COLUMN_OPTION: ColumnMeta = {
  verbose_name: COLUMN_NAME_ALIASES[DTTM_ALIAS],
  column_name: DTTM_ALIAS,
  type: 'TIMESTAMP',
  type_generic: GenericDataType.TEMPORAL,
  description: t(
    'A reference to the [Time] configuration, taking granularity into account',
  ),
};

export const QUERY_TIME_COLUMN_OPTION: QueryColumn = {
  column_name: DTTM_ALIAS,
  is_dttm: true,
  type: 'TIMESTAMP',
  type_generic: GenericDataType.TEMPORAL,
};

export const QueryModeLabel = {
  [QueryMode.aggregate]: t('Aggregate'),
  [QueryMode.raw]: t('Raw records'),
};

export const DEFAULT_SORT_SERIES_DATA: SortSeriesData = {
  sort_series_type: SortSeriesType.Sum,
  sort_series_ascending: false,
};

export const SORT_SERIES_CHOICES = [
  [SortSeriesType.Name, t('Category name')],
  [SortSeriesType.Sum, t('Total value')],
  [SortSeriesType.Min, t('Minimum value')],
  [SortSeriesType.Max, t('Maximum value')],
  [SortSeriesType.Avg, t('Average value')],
];

export const DEFAULT_XAXIS_SORT_SERIES_DATA: SortSeriesData = {
  sort_series_type: SortSeriesType.Name,
  sort_series_ascending: true,
};
