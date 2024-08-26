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
import { JsonObject } from '../../connection';
import { TimeGranularity } from '../../time-format';
import { RollingType, ComparisonType } from './AdvancedAnalytics';

export type NumpyFunction =
  | 'average'
  | 'argmin'
  | 'argmax'
  | 'count'
  | 'count_nonzero'
  | 'cumsum'
  | 'cumprod'
  | 'max'
  | 'mean'
  | 'median'
  | 'nansum'
  | 'nanmin'
  | 'nanmax'
  | 'nanmean'
  | 'nanmedian'
  | 'nanpercentile'
  | 'min'
  | 'percentile'
  | 'prod'
  | 'product'
  | 'std'
  | 'sum'
  | 'var';

export enum PandasAxis {
  Row = 0,
  Column = 1,
}

export interface Aggregates {
  /**
   * The name of the generated aggregate column.
   */
  [colname: string]: {
    operator: NumpyFunction;
    /**
     * the name of the column to generate aggregates from.
     */
    column?: string;
    options?: JsonObject;
  };
}

export type DefaultPostProcessing = undefined;

interface _PostProcessingAggregation {
  operation: 'aggregation';
  options: {
    groupby: string[];
    aggregates: Aggregates;
  };
}
export type PostProcessingAggregation =
  | _PostProcessingAggregation
  | DefaultPostProcessing;

export type BoxPlotQueryObjectWhiskerType = 'tukey' | 'min/max' | 'percentile';
interface _PostProcessingBoxplot {
  operation: 'boxplot';
  options: {
    groupby: string[];
    metrics: string[];
    whisker_type: BoxPlotQueryObjectWhiskerType;
    percentiles?: [number, number];
  };
}
export type PostProcessingBoxplot =
  | _PostProcessingBoxplot
  | DefaultPostProcessing;

interface _PostProcessingContribution {
  operation: 'contribution';
  options?: {
    orientation?: 'row' | 'column';
    columns?: string[];
    rename_columns?: string[];
  };
}
export type PostProcessingContribution =
  | _PostProcessingContribution
  | DefaultPostProcessing;

interface _PostProcessingPivot {
  operation: 'pivot';
  options: {
    aggregates: Aggregates;
    column_fill_value?: string;
    columns: string[];
    combine_value_with_metric?: boolean;
    drop_missing_columns?: boolean;
    index: string[];
    marginal_distribution_name?: string;
    marginal_distributions?: boolean;
    metric_fill_value?: any;
  };
}
export type PostProcessingPivot = _PostProcessingPivot | DefaultPostProcessing;

interface _PostProcessingProphet {
  operation: 'prophet';
  options: {
    time_grain: TimeGranularity | undefined;
    periods: number;
    confidence_interval: number;
    yearly_seasonality?: boolean | number;
    weekly_seasonality?: boolean | number;
    daily_seasonality?: boolean | number;
  };
}
export type PostProcessingProphet =
  | _PostProcessingProphet
  | DefaultPostProcessing;

interface _PostProcessingDiff {
  operation: 'diff';
  options: {
    columns: string[];
    periods: number;
    axis: PandasAxis;
  };
}
export type PostProcessingDiff = _PostProcessingDiff | DefaultPostProcessing;

interface _PostProcessingRolling {
  operation: 'rolling';
  options: {
    rolling_type: RollingType;
    window: number;
    min_periods: number;
    columns: string[];
  };
}
export type PostProcessingRolling =
  | _PostProcessingRolling
  | DefaultPostProcessing;

interface _PostProcessingCum {
  operation: 'cum';
  options: {
    columns: string[];
    operator: NumpyFunction;
  };
}
export type PostProcessingCum = _PostProcessingCum | DefaultPostProcessing;

export interface _PostProcessingCompare {
  operation: 'compare';
  options: {
    source_columns: string[];
    compare_columns: string[];
    compare_type: Omit<ComparisonType, ComparisonType.Values>;
    drop_original_columns: boolean;
  };
}
export type PostProcessingCompare =
  | _PostProcessingCompare
  | DefaultPostProcessing;

interface _PostProcessingSort {
  operation: 'sort';
  options: {
    is_sort_index?: boolean;
    by?: string[] | string;
    ascending?: boolean[] | boolean;
  };
}
export type PostProcessingSort = _PostProcessingSort | DefaultPostProcessing;

interface _PostProcessingResample {
  operation: 'resample';
  options: {
    method: string;
    rule: string;
    fill_value?: number | null;
  };
}
export type PostProcessingResample =
  | _PostProcessingResample
  | DefaultPostProcessing;

interface _PostProcessingRename {
  operation: 'rename';
  options: {
    columns: Record<string, string | null>;
    inplace?: boolean;
    level?: number | string;
  };
}
export type PostProcessingRename =
  | _PostProcessingRename
  | DefaultPostProcessing;

interface _PostProcessingFlatten {
  operation: 'flatten';
  options?: {
    reset_index?: boolean;
    drop_levels?: number[] | string[];
  };
}
export type PostProcessingFlatten =
  | _PostProcessingFlatten
  | DefaultPostProcessing;

interface _PostProcessingRank {
  operation: 'rank';
  options?: {
    metric: string;
    group_by: string | null;
  };
}
export type PostProcessingRank = _PostProcessingRank | DefaultPostProcessing;

interface _PostProcessingHistogram {
  operation: 'histogram';
  options?: {
    column: string;
    groupby: string[];
    bins: number;
    cumulative?: boolean;
    normalize?: boolean;
  };
}
export type PostProcessingHistogram =
  | _PostProcessingHistogram
  | DefaultPostProcessing;

/**
 * Parameters for chart data postprocessing.
 * See superset/utils/pandas_processing.py.
 */
export type PostProcessingRule =
  | PostProcessingAggregation
  | PostProcessingBoxplot
  | PostProcessingContribution
  | PostProcessingPivot
  | PostProcessingProphet
  | PostProcessingDiff
  | PostProcessingRolling
  | PostProcessingCum
  | PostProcessingCompare
  | PostProcessingSort
  | PostProcessingResample
  | PostProcessingRename
  | PostProcessingFlatten
  | PostProcessingHistogram
  | PostProcessingRank;

export function isPostProcessingAggregation(
  rule?: PostProcessingRule,
): rule is PostProcessingAggregation {
  return rule?.operation === 'aggregation';
}

export function isPostProcessingBoxplot(
  rule?: PostProcessingRule,
): rule is PostProcessingBoxplot {
  return rule?.operation === 'boxplot';
}

export function isPostProcessingContribution(
  rule?: PostProcessingRule,
): rule is PostProcessingContribution {
  return rule?.operation === 'contribution';
}

export function isPostProcessingPivot(
  rule?: PostProcessingRule,
): rule is PostProcessingPivot {
  return rule?.operation === 'pivot';
}

export function isPostProcessingProphet(
  rule?: PostProcessingRule,
): rule is PostProcessingProphet {
  return rule?.operation === 'prophet';
}

export function isPostProcessingDiff(
  rule?: PostProcessingRule,
): rule is PostProcessingDiff {
  return rule?.operation === 'diff';
}

export function isPostProcessingRolling(
  rule?: PostProcessingRule,
): rule is PostProcessingRolling {
  return rule?.operation === 'rolling';
}

export function isPostProcessingCum(
  rule?: PostProcessingRule,
): rule is PostProcessingCum {
  return rule?.operation === 'cum';
}

export function isPostProcessingCompare(
  rule?: PostProcessingRule,
): rule is PostProcessingCompare {
  return rule?.operation === 'compare';
}

export function isPostProcessingSort(
  rule?: PostProcessingRule,
): rule is PostProcessingSort {
  return rule?.operation === 'sort';
}

export function isPostProcessingResample(
  rule?: PostProcessingRule,
): rule is PostProcessingResample {
  return rule?.operation === 'resample';
}

export function isPostProcessingRename(
  rule?: PostProcessingRule,
): rule is PostProcessingRename {
  return rule?.operation === 'rename';
}

export function isPostProcessingFlatten(
  rule?: PostProcessingRule,
): rule is PostProcessingFlatten {
  return rule?.operation === 'flatten';
}

export function isPostProcessingRank(
  rule?: PostProcessingRule,
): rule is PostProcessingRank {
  return rule?.operation === 'rank';
}

export function isPostProcessingHistogram(
  rule?: PostProcessingRule,
): rule is PostProcessingHistogram {
  return rule?.operation === 'histogram';
}
