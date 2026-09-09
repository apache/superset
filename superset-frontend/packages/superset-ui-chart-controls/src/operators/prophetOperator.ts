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
 * specific language governing permissions and limitationsxw
 * under the License.
 */
import {
  PostProcessingProphet,
  TimeGranularity,
  getXAxisColumn,
  getXAxisLabel,
  isAdhocColumn,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';

// Fallback grain used only when no time grain can be resolved from the form
// data, query object, or x-axis column. Matches the `time_grain_sqla` control
// default in sharedControls so forecasting stays functional rather than failing
// with an opaque backend error.
const DEFAULT_TIME_GRAIN = TimeGranularity.DAY;

/* eslint-disable @typescript-eslint/no-unused-vars */
export const prophetOperator: PostProcessingFactory<PostProcessingProphet> = (
  formData,
  queryObject,
) => {
  const xAxisLabel = getXAxisLabel(formData);
  if (formData.forecastEnabled && xAxisLabel) {
    // The effective time grain can live in several places depending on how the
    // chart was configured. Prefer, in order:
    //   1. the grain popover on an adhoc x-axis column (generic x-axis),
    //   2. the grain resolved onto the query object's extras (picks up
    //      dashboard-applied grains and the panel control),
    //   3. the `time_grain_sqla` panel control on the form data directly.
    // Fall back to a daily grain so a saved/dashboard chart with the grain
    // cleared to "None" still forecasts instead of raising a backend error.
    const xAxisColumn = getXAxisColumn(formData);
    const timeGrain =
      (isAdhocColumn(xAxisColumn) &&
        (xAxisColumn.timeGrain as TimeGranularity)) ||
      queryObject.extras?.time_grain_sqla ||
      formData.time_grain_sqla ||
      DEFAULT_TIME_GRAIN;
    return {
      operation: 'prophet',
      options: {
        time_grain: timeGrain,
        periods: parseInt(formData.forecastPeriods, 10),
        confidence_interval: parseFloat(formData.forecastInterval),
        yearly_seasonality: formData.forecastSeasonalityYearly,
        weekly_seasonality: formData.forecastSeasonalityWeekly,
        daily_seasonality: formData.forecastSeasonalityDaily,
        index: xAxisLabel,
      },
    };
  }
  return undefined;
};
