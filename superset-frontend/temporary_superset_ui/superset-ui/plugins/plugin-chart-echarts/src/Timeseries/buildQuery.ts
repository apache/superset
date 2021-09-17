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
import { buildQueryContext, QueryFormData, normalizeOrderBy } from '@superset-ui/core';
import {
  rollingWindowOperator,
  timeCompareOperator,
  isValidTimeCompare,
  sortOperator,
  pivotOperator,
  resampleOperator,
} from '@superset-ui/chart-controls';

export default function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      is_timeseries: true,
      // todo: move `normalizeOrderBy to extractQueryFields`
      orderby: normalizeOrderBy(baseQueryObject).orderby,
      time_offsets: isValidTimeCompare(formData, baseQueryObject) ? formData.time_compare : [],
      post_processing: [
        resampleOperator(formData, baseQueryObject),
        timeCompareOperator(formData, baseQueryObject),
        sortOperator(formData, { ...baseQueryObject, is_timeseries: true }),
        rollingWindowOperator(formData, baseQueryObject),
        pivotOperator(formData, { ...baseQueryObject, is_timeseries: true }),
        formData.contributionMode
          ? {
              operation: 'contribution',
              options: {
                orientation: formData.contributionMode,
              },
            }
          : undefined,
        formData.forecastEnabled
          ? {
              operation: 'prophet',
              options: {
                time_grain: formData.time_grain_sqla,
                periods: parseInt(formData.forecastPeriods, 10),
                confidence_interval: parseFloat(formData.forecastInterval),
                yearly_seasonality: formData.forecastSeasonalityYearly,
                weekly_seasonality: formData.forecastSeasonalityWeekly,
                daily_seasonality: formData.forecastSeasonalityDaily,
              },
            }
          : undefined,
      ],
    },
  ]);
}
