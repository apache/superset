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

interface Aggregates {
  /**
   * The name of the generated aggregate column.
   */
  [colname: string]: {
    operator: NumpyFunction;
    /**
     * the name of the column to generate aggrates from.
     */
    column?: string;
    options?: JsonObject;
  };
}

export interface PostProcessingAggregation {
  operation: 'aggregation';
  options: {
    groupby: string[];
    aggregates: Aggregates;
  };
}

export interface PostProcessingBoxplot {
  operation: 'boxplot';
  options: {
    groupby: string[];
    metrics: string[];
    whisker_type: 'tukey' | 'min/max' | 'percentile';
    percentiles?: [number, number];
  };
}

export interface PostProcessingContribution {
  operation: 'contribution';
  options?: {
    orientation?: 'row' | 'column';
    columns?: string[];
    rename_columns?: string[];
  };
}

export interface PostProcessingPivot {
  operation: 'pivot';
  options: {
    index: string[];
    columns: string[];
    aggregates: Aggregates;
  };
}

export interface PostProcessingProphet {
  operation: 'prophet';
  options: {
    time_grain: TimeGranularity;
    periods: number;
    confidence_interval: number;
    yearly_seasonality?: boolean | number;
    weekly_seasonality?: boolean | number;
    daily_seasonality?: boolean | number;
  };
}

/**
 * Parameters for chart data postprocessing.
 * See superset/utils/pandas_processing.py.
 */
export type PostProcessingRule =
  | PostProcessingAggregation
  | PostProcessingBoxplot
  | PostProcessingContribution
  | PostProcessingPivot
  | PostProcessingProphet;
