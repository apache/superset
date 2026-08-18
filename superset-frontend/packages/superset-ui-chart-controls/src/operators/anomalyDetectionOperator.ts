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
  getXAxisLabel,
} from '@superset-ui/core';
import { PostProcessingFactory } from './types';

export const anomalyDetectionOperator: PostProcessingFactory<
  PostProcessingAnomalyDetection
> = (formData, _queryObject) => {
  const xAxisLabel = getXAxisLabel(formData);
  if (formData.anomalyDetectionEnabled && xAxisLabel) {
    const method: string = formData.anomalyDetectionMethod || 'zscore';
    // Prophet requires a temporal x-axis; skip if no temporal indicator present
    if (
      method === 'prophet' &&
      !formData.granularity_sqla &&
      !formData.time_grain_sqla
    ) {
      return undefined;
    }
    const options: Record<string, unknown> = { method, index: xAxisLabel };
    if (method === 'prophet') {
      const confidenceInterval = parseFloat(
        formData.anomalyDetectionConfidenceInterval,
      );
      options.confidence_interval = Number.isNaN(confidenceInterval)
        ? 0.8
        : confidenceInterval;
      options.yearly_seasonality = formData.anomalyDetectionSeasonalityYearly;
      options.weekly_seasonality = formData.anomalyDetectionSeasonalityWeekly;
      options.daily_seasonality = formData.anomalyDetectionSeasonalityDaily;
    } else {
      const rollingWindow = parseInt(
        formData.anomalyDetectionRollingWindow,
        10,
      );
      options.rolling_window = Number.isNaN(rollingWindow)
        ? 14
        : rollingWindow;
      const sensitivity = parseFloat(formData.anomalyDetectionSensitivity);
      options.sensitivity = Number.isNaN(sensitivity) ? 3.0 : sensitivity;
    }
    return {
      operation: 'anomaly_detection',
      options,
    } as PostProcessingAnomalyDetection;
  }
  return undefined;
};
