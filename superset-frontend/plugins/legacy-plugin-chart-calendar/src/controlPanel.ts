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
import { t, legacyValidateInteger } from '@superset-ui/core';
import {
  ControlPanelConfig,
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
  AdhocFiltersControl,
  GranularitySqlaControl,
  LinearColorSchemeControl,
  MetricsControl,
  TimeRangeControl,
  YAxisFormatControl,
  InlineSelectControl,
  InlineTextControl,
  InlineCheckboxControl,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Time'),
      expanded: true,
      description: t('Time related form attributes'),
      controlSetRows: [[GranularitySqlaControl()], [TimeRangeControl()]],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          InlineSelectControl('domain_granularity', {
            label: t('Domain'),
            default: 'month',
            choices: [
              ['hour', t('hour')],
              ['day', t('day')],
              ['week', t('week')],
              ['month', t('month')],
              ['year', t('year')],
            ],
            description: t('The time unit used for the grouping of blocks'),
          }),
          InlineSelectControl('subdomain_granularity', {
            label: t('Subdomain'),
            default: 'day',
            choices: [
              ['min', t('min')],
              ['hour', t('hour')],
              ['day', t('day')],
              ['week', t('week')],
              ['month', t('month')],
            ],
            description: t(
              'The time unit for each block. Should be a smaller unit than ' +
                'domain_granularity. Should be larger or equal to Time Grain',
            ),
          }),
        ],
        [MetricsControl()],
        [AdhocFiltersControl()],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [LinearColorSchemeControl()],
        [
          InlineTextControl('cell_size', {
            label: t('Cell Size'),
            default: 10,
            isInt: true,
            validators: [legacyValidateInteger],
            renderTrigger: true,
            description: t('The size of the square cell, in pixels'),
          }),
          InlineTextControl('cell_padding', {
            label: t('Cell Padding'),
            default: 2,
            isInt: true,
            validators: [legacyValidateInteger],
            renderTrigger: true,
            description: t('The distance between cells, in pixels'),
          }),
        ],
        [
          InlineTextControl('cell_radius', {
            label: t('Cell Radius'),
            default: 0,
            isInt: true,
            validators: [legacyValidateInteger],
            renderTrigger: true,
            description: t('The pixel radius'),
          }),
          InlineTextControl('steps', {
            label: t('Color Steps'),
            default: 10,
            isInt: true,
            validators: [legacyValidateInteger],
            renderTrigger: true,
            description: t('The number color "steps"'),
          }),
        ],
        [
          YAxisFormatControl(),
          InlineSelectControl('x_axis_time_format', {
            label: t('Time Format'),
            default: 'smart_date',
            freeForm: true,
            renderTrigger: true,
            choices: D3_TIME_FORMAT_OPTIONS,
            description: D3_FORMAT_DOCS,
          }),
        ],
        [
          InlineCheckboxControl('show_legend', {
            label: t('Legend'),
            default: true,
            renderTrigger: true,
            description: t('Whether to display the legend (toggles)'),
          }),
          InlineCheckboxControl('show_values', {
            label: t('Show Values'),
            default: false,
            renderTrigger: true,
            description: t(
              'Whether to display the numerical values within the cells',
            ),
          }),
        ],
        [
          InlineCheckboxControl('show_metric_name', {
            label: t('Show Metric Names'),
            default: true,
            renderTrigger: true,
            description: t('Whether to display the metric name as a title'),
          }),
          null,
        ],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number Format'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
  }),
};

export default config;
