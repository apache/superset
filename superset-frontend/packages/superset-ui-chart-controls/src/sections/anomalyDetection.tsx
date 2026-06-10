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
import { t } from '@apache-superset/core/translation';
import { legacyValidateInteger, legacyValidateNumber } from '@superset-ui/core';
import { ControlPanelSectionConfig } from '../types';
import { displayTimeRelatedControls } from '../utils';

const validateRange =
  (
    check: (n: number) => boolean,
    message: string,
  ): ((v: unknown) => string | false) =>
  (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && check(n) ? t(message) : false;
  };

const validateMinRollingWindow = validateRange(
  n => n < 3,
  'Rolling window must be >= 3',
);
const validatePositiveNumber = validateRange(
  n => n <= 0,
  'Value must be a positive number',
);
const validateConfidenceInterval = validateRange(
  n => n <= 0 || n >= 1,
  'Confidence interval must be between 0 and 1 (exclusive)',
);
export const ANOMALY_DEFAULT_DATA = {
  anomalyDetectionEnabled: false,
  anomalyDetectionMethod: 'zscore',
  anomalyDetectionRollingWindow: 14,
  anomalyDetectionSensitivity: 3.0,
  anomalyDetectionConfidenceInterval: 0.8,
  anomalyDetectionSeasonalityYearly: null,
  anomalyDetectionSeasonalityWeekly: null,
  anomalyDetectionSeasonalityDaily: null,
};

export const anomalyDetectionControls: ControlPanelSectionConfig = {
  label: t('Anomaly Detection'),
  expanded: false,
  visibility: displayTimeRelatedControls,
  controlSetRows: [
    [
      {
        name: 'anomalyDetectionEnabled',
        config: {
          type: 'CheckboxControl',
          label: t('Enable anomaly detection'),
          renderTrigger: false,
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionEnabled,
          description: t('Enable anomaly detection on the time series'),
        },
      },
    ],
    [
      {
        name: 'anomalyDetectionMethod',
        config: {
          type: 'SelectControl',
          label: t('Detection method'),
          choices: [
            ['zscore', t('Z-Score')],
            ['mad', t('MAD (Median Absolute Deviation)')],
            ['prophet', t('Prophet (Seasonality-aware)')],
          ],
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionMethod,
          description: t(
            'Algorithm to use for anomaly detection. Z-Score uses rolling mean and standard deviation. MAD uses rolling median absolute deviation which is more robust to outliers. Prophet uses Facebook Prophet to model seasonality and flags points outside the confidence interval.',
          ),
        },
      },
    ],
    [
      {
        name: 'anomalyDetectionRollingWindow',
        config: {
          type: 'TextControl',
          label: t('Rolling window'),
          validators: [legacyValidateInteger, validateMinRollingWindow],
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionRollingWindow,
          description: t(
            'Size of the rolling window for computing statistics. Must be >= 3.',
          ),
          visibility: ({ controls }) =>
            controls?.anomalyDetectionMethod?.value !== 'prophet',
        },
      },
    ],
    [
      {
        name: 'anomalyDetectionSensitivity',
        config: {
          type: 'TextControl',
          label: t('Sensitivity'),
          validators: [legacyValidateNumber, validatePositiveNumber],
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionSensitivity,
          description: t(
            'Threshold for anomaly detection. Higher values mean fewer anomalies are detected. Typical values: 2.0 (more sensitive) to 4.0 (less sensitive).',
          ),
          visibility: ({ controls }) =>
            controls?.anomalyDetectionMethod?.value !== 'prophet',
        },
      },
    ],
    [
      {
        name: 'anomalyDetectionConfidenceInterval',
        config: {
          type: 'TextControl',
          label: t('Confidence interval'),
          validators: [legacyValidateNumber, validateConfidenceInterval],
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionConfidenceInterval,
          description: t(
            'Width of the confidence interval. Should be between 0 and 1',
          ),
          visibility: ({ controls }) =>
            controls?.anomalyDetectionMethod?.value === 'prophet',
        },
      },
    ],
    [
      {
        name: 'anomalyDetectionSeasonalityYearly',
        config: {
          type: 'SelectControl',
          freeForm: true,
          label: t('Yearly seasonality'),
          choices: [
            [null, t('default')],
            [true, t('Yes')],
            [false, t('No')],
          ],
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionSeasonalityYearly,
          description: t(
            'Should yearly seasonality be applied. An integer value will specify Fourier order of seasonality.',
          ),
          visibility: ({ controls }) =>
            controls?.anomalyDetectionMethod?.value === 'prophet',
        },
      },
    ],
    [
      {
        name: 'anomalyDetectionSeasonalityWeekly',
        config: {
          type: 'SelectControl',
          freeForm: true,
          label: t('Weekly seasonality'),
          choices: [
            [null, t('default')],
            [true, t('Yes')],
            [false, t('No')],
          ],
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionSeasonalityWeekly,
          description: t(
            'Should weekly seasonality be applied. An integer value will specify Fourier order of seasonality.',
          ),
          visibility: ({ controls }) =>
            controls?.anomalyDetectionMethod?.value === 'prophet',
        },
      },
    ],
    [
      {
        name: 'anomalyDetectionSeasonalityDaily',
        config: {
          type: 'SelectControl',
          freeForm: true,
          label: t('Daily seasonality'),
          choices: [
            [null, t('default')],
            [true, t('Yes')],
            [false, t('No')],
          ],
          default: ANOMALY_DEFAULT_DATA.anomalyDetectionSeasonalityDaily,
          description: t(
            'Should daily seasonality be applied. An integer value will specify Fourier order of seasonality.',
          ),
          visibility: ({ controls }) =>
            controls?.anomalyDetectionMethod?.value === 'prophet',
        },
      },
    ],
  ],
};
