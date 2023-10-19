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
import React from 'react';
import {
  ChartDataResponseResult,
  GenericDataType,
  QueryFormMetric,
  t,
  validateNumber,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlSubSectionHeader,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  sections,
  sharedControls,
  ControlFormItemSpec,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';
import { LABEL_POSITION } from '../constants';
import { legendSection } from '../controls';

const { labelType, labelPosition, numberFormat, showLabels, isCircle } =
  DEFAULT_FORM_DATA;

const radarMetricMaxValue: { name: string; config: ControlFormItemSpec } = {
  name: 'radarMetricMaxValue',
  config: {
    controlType: 'InputNumber',
    label: t('Max'),
    description: t(
      'The maximum value of metrics. It is an optional configuration',
    ),
    width: 120,
    placeholder: t('auto'),
    debounceDelay: 400,
    validators: [validateNumber],
  },
};

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metrics'],
        ['timeseries_limit_metric'],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
              default: 10,
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ...legendSection,
        [<ControlSubSectionHeader>{t('Labels')}</ControlSubSectionHeader>],
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Labels'),
              renderTrigger: true,
              default: showLabels,
              description: t('Whether to display the labels.'),
            },
          },
        ],
        [
          {
            name: 'label_type',
            config: {
              type: 'SelectControl',
              label: t('Label Type'),
              default: labelType,
              renderTrigger: true,
              choices: [
                ['value', t('Value')],
                ['key_value', t('Category and Value')],
              ],
              description: t('What should be shown on the label?'),
            },
          },
        ],
        [
          {
            name: 'label_position',
            config: {
              type: 'SelectControl',
              freeForm: false,
              label: t('Label position'),
              renderTrigger: true,
              choices: LABEL_POSITION,
              default: labelPosition,
              description: D3_FORMAT_DOCS,
            },
          },
        ],
        [
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Number format'),
              renderTrigger: true,
              default: numberFormat,
              choices: D3_FORMAT_OPTIONS,
              description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
            },
          },
        ],
        [
          {
            name: 'date_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              default: 'smart_date',
              description: D3_FORMAT_DOCS,
            },
          },
        ],
        [<ControlSubSectionHeader>{t('Radar')}</ControlSubSectionHeader>],
        [
          {
            name: 'column_config',
            config: {
              type: 'ColumnConfigControl',
              label: t('Customize Metrics'),
              description: t('Further customize how to display each metric'),
              renderTrigger: true,
              configFormLayout: {
                [GenericDataType.NUMERIC]: [[radarMetricMaxValue]],
              },
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(explore, _, chart) {
                const values =
                  (explore?.controls?.metrics?.value as QueryFormMetric[]) ??
                  [];
                const metricColumn = values.map(value => {
                  if (typeof value === 'string') {
                    return value;
                  }
                  return value.label;
                });
                return {
                  queryResponse: chart?.queriesResponse?.[0] as
                    | ChartDataResponseResult
                    | undefined,
                  appliedColumnNames: metricColumn,
                };
              },
            },
          },
        ],
        [
          {
            name: 'is_circle',
            config: {
              type: 'CheckboxControl',
              label: t('Circle radar shape'),
              renderTrigger: true,
              default: isCircle,
              description: t(
                "Radar render type, whether to display 'circle' shape.",
              ),
            },
          },
        ],
      ],
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;
