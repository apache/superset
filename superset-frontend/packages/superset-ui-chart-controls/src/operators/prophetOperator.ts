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
import { PostProcessingProphet, getXAxisLabel } from '@superset-ui/core';
import { PostProcessingFactory } from './types';

/* eslint-disable @typescript-eslint/no-unused-vars */
export const prophetOperator: PostProcessingFactory<PostProcessingProphet> = (
  formData,
  queryObject,
) => {
  const xAxisLabel = getXAxisLabel(formData);
  if (formData.forecastEnabled && xAxisLabel) {
    return {
      operation: 'prophet',
      options: {
        time_grain: formData.time_grain_sqla,
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
