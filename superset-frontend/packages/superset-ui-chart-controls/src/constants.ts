// DODO was here
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
  type_generic: GenericDataType.Temporal,
  description: t(
    'A reference to the [Time] configuration, taking granularity into account',
  ),
};

export const QUERY_TIME_COLUMN_OPTION: QueryColumn = {
  column_name: DTTM_ALIAS,
  is_dttm: true,
  type: 'TIMESTAMP',
  type_generic: GenericDataType.Temporal,
};

export const QueryModeLabel = {
  [QueryMode.Aggregate]: t('Aggregate'),
  [QueryMode.Raw]: t('Raw records'),
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

// DODO added 45525377
export const AGGREGATE_FUNCTION_OPTIONS = [
  ['Count', t('Count')],
  ['Count Unique Values', t('Count Unique Values')],
  ['List Unique Values', t('List Unique Values')],
  ['Sum', t('Sum')],
  ['Average', t('Average')],
  ['Median', t('Median')],
  ['Sample Variance', t('Sample Variance')],
  ['Sample Standard Deviation', t('Sample Standard Deviation')],
  ['Minimum', t('Minimum')],
  ['Maximum', t('Maximum')],
  ['First', t('First')],
  ['Last', t('Last')],
  ['Sum as Fraction of Total', t('Sum as Fraction of Total')],
  ['Sum as Fraction of Rows', t('Sum as Fraction of Rows')],
  ['Sum as Fraction of Columns', t('Sum as Fraction of Columns')],
  ['Count as Fraction of Total', t('Count as Fraction of Total')],
  ['Count as Fraction of Rows', t('Count as Fraction of Rows')],
  ['Count as Fraction of Columns', t('Count as Fraction of Columns')],
];
