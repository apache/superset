/*
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
  Aggregates,
  isPostProcessingAggregation,
  isPostProcessingBoxplot,
  isPostProcessingCompare,
  isPostProcessingContribution,
  isPostProcessingCum,
  isPostProcessingDiff,
  isPostProcessingPivot,
  isPostProcessingProphet,
  isPostProcessingRolling,
  isPostProcessingResample,
  isPostProcessingSort,
  PandasAxis,
  PostProcessingAggregation,
  PostProcessingBoxplot,
  PostProcessingCompare,
  PostProcessingContribution,
  PostProcessingCum,
  PostProcessingDiff,
  PostProcessingPivot,
  PostProcessingProphet,
  PostProcessingResample,
  PostProcessingRolling,
  PostProcessingSort,
  PostProcessingHistogram,
  isPostProcessingHistogram,
  PostProcessingRename,
  PostProcessingFlatten,
  PostProcessingRank,
  isPostProcessingRename,
  isPostProcessingFlatten,
  isPostProcessingRank,
} from '@superset-ui/core';
import { ComparisonType, RollingType, TimeGranularity } from '../../../src';

const AGGREGATES_OPTION: Aggregates = {
  bar: {
    operator: 'max',
    column: 'bar',
    options: {},
  },
};

const AGGREGATE_RULE: PostProcessingAggregation = {
  operation: 'aggregation',
  options: {
    groupby: ['foo'],
    aggregates: AGGREGATES_OPTION,
  },
};

const BOXPLOT_RULE: PostProcessingBoxplot = {
  operation: 'boxplot',
  options: {
    groupby: ['foo'],
    metrics: ['bar'],
    whisker_type: 'tukey',
  },
};

const COMPARE_RULE: PostProcessingCompare = {
  operation: 'compare',
  options: {
    source_columns: ['foo'],
    compare_columns: ['bar'],
    compare_type: ComparisonType.Percentage,
    drop_original_columns: false,
  },
};

const CONTRIBUTION_RULE: PostProcessingContribution = {
  operation: 'contribution',
  options: {
    orientation: 'row',
    columns: ['foo'],
  },
};

const CUM_RULE: PostProcessingCum = {
  operation: 'cum',
  options: {
    columns: ['foo'],
    operator: 'min',
  },
};

const DIFF_RULE: PostProcessingDiff = {
  operation: 'diff',
  options: {
    columns: ['foo'],
    periods: 12,
    axis: PandasAxis.Column,
  },
};

const PIVOT_RULE: PostProcessingPivot = {
  operation: 'pivot',
  options: {
    index: ['foo'],
    columns: ['bar'],
    aggregates: AGGREGATES_OPTION,
  },
};

const PROPHET_RULE: PostProcessingProphet = {
  operation: 'prophet',
  options: {
    time_grain: TimeGranularity.DAY,
    periods: 365,
    confidence_interval: 0.8,
    yearly_seasonality: false,
    weekly_seasonality: false,
    daily_seasonality: false,
  },
};

const RESAMPLE_RULE: PostProcessingResample = {
  operation: 'resample',
  options: {
    method: 'method',
    rule: 'rule',
    fill_value: null,
  },
};

const ROLLING_RULE: PostProcessingRolling = {
  operation: 'rolling',
  options: {
    rolling_type: RollingType.Cumsum,
    window: 12,
    min_periods: 12,
    columns: ['foo', 'bar'],
  },
};

const SORT_RULE: PostProcessingSort = {
  operation: 'sort',
  options: {
    by: 'foo',
  },
};

const HISTOGRAM_RULE: PostProcessingHistogram = {
  operation: 'histogram',
  options: {
    column: 'foo',
    groupby: ['bar'],
    bins: 5,
    normalize: true,
    cumulative: true,
  },
};

const RENAME_RULE: PostProcessingRename = {
  operation: 'rename',
  options: {
    columns: {
      foo: 'bar',
    },
  },
};

const FLATTEN_RULE: PostProcessingFlatten = {
  operation: 'flatten',
};

const RANK_RULE: PostProcessingRank = {
  operation: 'rank',
  options: {
    metric: 'foo',
    group_by: 'bar',
  },
};

test('PostProcessingAggregation type guard', () => {
  expect(isPostProcessingAggregation(AGGREGATE_RULE)).toEqual(true);
  expect(isPostProcessingAggregation(BOXPLOT_RULE)).toEqual(false);
  expect(isPostProcessingAggregation(undefined)).toEqual(false);
});

test('PostProcessingBoxplot type guard', () => {
  expect(isPostProcessingBoxplot(BOXPLOT_RULE)).toEqual(true);
  expect(isPostProcessingBoxplot(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingBoxplot(undefined)).toEqual(false);
});

test('PostProcessingCompare type guard', () => {
  expect(isPostProcessingCompare(COMPARE_RULE)).toEqual(true);
  expect(isPostProcessingCompare(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingCompare(undefined)).toEqual(false);
});

test('PostProcessingContribution type guard', () => {
  expect(isPostProcessingContribution(CONTRIBUTION_RULE)).toEqual(true);
  expect(isPostProcessingContribution(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingContribution(undefined)).toEqual(false);
});

test('PostProcessingCum type guard', () => {
  expect(isPostProcessingCum(CUM_RULE)).toEqual(true);
  expect(isPostProcessingCum(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingCum(undefined)).toEqual(false);
});

test('PostProcessingDiff type guard', () => {
  expect(isPostProcessingDiff(DIFF_RULE)).toEqual(true);
  expect(isPostProcessingDiff(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingDiff(undefined)).toEqual(false);
});

test('PostProcessingPivot type guard', () => {
  expect(isPostProcessingPivot(PIVOT_RULE)).toEqual(true);
  expect(isPostProcessingPivot(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingPivot(undefined)).toEqual(false);
});

test('PostProcessingProphet type guard', () => {
  expect(isPostProcessingProphet(PROPHET_RULE)).toEqual(true);
  expect(isPostProcessingProphet(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingProphet(undefined)).toEqual(false);
});

test('PostProcessingResample type guard', () => {
  expect(isPostProcessingResample(RESAMPLE_RULE)).toEqual(true);
  expect(isPostProcessingResample(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingResample(undefined)).toEqual(false);
});

test('PostProcessingRolling type guard', () => {
  expect(isPostProcessingRolling(ROLLING_RULE)).toEqual(true);
  expect(isPostProcessingRolling(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingRolling(undefined)).toEqual(false);
});

test('PostProcessingSort type guard', () => {
  expect(isPostProcessingSort(SORT_RULE)).toEqual(true);
  expect(isPostProcessingSort(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingSort(undefined)).toEqual(false);
});

test('PostProcessingHistogram type guard', () => {
  expect(isPostProcessingHistogram(HISTOGRAM_RULE)).toEqual(true);
  expect(isPostProcessingHistogram(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingHistogram(undefined)).toEqual(false);
});

test('PostProcessingRename type guard', () => {
  expect(isPostProcessingRename(RENAME_RULE)).toEqual(true);
  expect(isPostProcessingRename(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingRename(undefined)).toEqual(false);
});

test('PostProcessingFlatten type guard', () => {
  expect(isPostProcessingFlatten(FLATTEN_RULE)).toEqual(true);
  expect(isPostProcessingFlatten(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingFlatten(undefined)).toEqual(false);
});

test('PostProcessingRank type guard', () => {
  expect(isPostProcessingRank(RANK_RULE)).toEqual(true);
  expect(isPostProcessingRank(AGGREGATE_RULE)).toEqual(false);
  expect(isPostProcessingRank(undefined)).toEqual(false);
});
