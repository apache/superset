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
  FeatureFlag,
  GenericDataType,
  isFeatureEnabled,
  QueryFormMetric,
  t,
  validateNumber,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import { ControlFormItemSpec } from '@superset-ui/chart-controls/lib/components/ControlForm';
import { DEFAULT_FORM_DATA } from './types';
import { LABEL_POSITION } from '../constants';
import { legendSection } from '../controls';

const {
  labelType,
  labelPosition,
  numberFormat,
  showLabels,
  isCircle,
  emitFilter,
} = DEFAULT_FORM_DATA;

const radarMetricMaxValue: { name: string; config: ControlFormItemSpec } = {
  name: 'radarMetricMaxValue',
  config: {
    controlType: 'InputNumber',
    label: t('Max'),
    description: t('The maximum value of metrics. It is an optional configuration'),
    width: 120,
    placeholder: 'auto',
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
        isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)
          ? [
              {
                name: 'emit_filter',
                config: {
                  type: 'CheckboxControl',
                  label: t('Enable emitting filters'),
                  default: emitFilter,
                  renderTrigger: true,
                  description: t('Enable emmiting filters.'),
                },
              },
            ]
          : [],
        ...legendSection,
        [<h1 className="section-header">{t('Labels')}</h1>],
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
                ['value', 'Value'],
                ['key_value', 'Category and Value'],
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
              description: `${t('D3 format syntax: https://github.com/d3/d3-format. ')} ${t(
                'Only applies when "Label Type" is set to show values.',
              )}`,
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
        [<h1 className="section-header">{t('Radar')}</h1>],
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
              mapStateToProps(explore, control, chart) {
                const values = (explore?.controls?.metrics?.value as QueryFormMetric[]) ?? [];
                const metricColumn = values.map(value => {
                  if (typeof value === 'string') {
                    return value;
                  }
                  return value.label;
                });
                return {
                  queryResponse: chart?.queriesResponse?.[0] as ChartDataResponseResult | undefined,
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
              description: t("Radar render type, whether to display 'circle' shape."),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
