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
  PostProcessingAnomalyDetection,
  TimeGranularity,
  getXAxisColumn,
  getXAxisLabel,
  isAdhocColumn,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';

export const anomalyDetectionOperator: PostProcessingFactory<
  PostProcessingAnomalyDetection
> = (formData, _queryObject) => {
  const xAxisLabel = getXAxisLabel(formData);
  if (!formData.anomalyDetectionEnabled || !xAxisLabel) {
    return undefined;
  }
  const method = (formData.anomalyDetectionMethod || 'zscore') as
    | 'zscore'
    | 'mad'
    | 'prophet';
  // Prophet requires a temporal x-axis; skip if no temporal indicator present
  const xAxisColumn = getXAxisColumn(formData);
  const hasTemporalIndicator =
    (isAdhocColumn(xAxisColumn) &&
      Boolean(xAxisColumn.timeGrain as TimeGranularity)) ||
    Boolean(formData.granularity_sqla) ||
    Boolean(formData.time_grain_sqla);
  if (method === 'prophet' && !hasTemporalIndicator) {
    return undefined;
  }
  if (method === 'prophet') {
    const confidenceInterval = parseFloat(
      formData.anomalyDetectionConfidenceInterval,
    );
    return {
      operation: 'anomaly_detection',
      options: {
        method,
        index: xAxisLabel,
        confidence_interval: Number.isNaN(confidenceInterval)
          ? 0.8
          : confidenceInterval,
        yearly_seasonality: formData.anomalyDetectionSeasonalityYearly,
        weekly_seasonality: formData.anomalyDetectionSeasonalityWeekly,
        daily_seasonality: formData.anomalyDetectionSeasonalityDaily,
      },
    };
  }
  const rollingWindow = parseInt(formData.anomalyDetectionRollingWindow, 10);
  const sensitivity = parseFloat(formData.anomalyDetectionSensitivity);
  return {
    operation: 'anomaly_detection',
    options: {
      method,
      index: xAxisLabel,
      rolling_window: Number.isNaN(rollingWindow) ? 14 : rollingWindow,
      sensitivity: Number.isNaN(sensitivity) ? 3.0 : sensitivity,
    },
  };
};
