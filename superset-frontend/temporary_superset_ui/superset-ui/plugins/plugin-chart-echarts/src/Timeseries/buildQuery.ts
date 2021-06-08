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
import { buildQueryContext, getMetricLabel, QueryFormData } from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => {
    const metricLabels = (baseQueryObject.metrics || []).map(getMetricLabel);
    const { timeseries_limit_metric, order_desc, orderby } = baseQueryObject;
    return [
      {
        ...baseQueryObject,
        groupby: formData.groupby || [],
        is_timeseries: true,
        orderby: orderby?.length
          ? orderby
          : timeseries_limit_metric
          ? [[timeseries_limit_metric, !order_desc]]
          : [],
        post_processing: [
          {
            operation: 'pivot',
            options: {
              index: ['__timestamp'],
              columns: formData.groupby || [],
              // Create 'dummy' sum aggregates to assign cell values in pivot table
              aggregates: Object.fromEntries(
                metricLabels.map(metric => [metric, { operator: 'sum' }]),
              ),
            },
          },
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
    ];
  });
}
