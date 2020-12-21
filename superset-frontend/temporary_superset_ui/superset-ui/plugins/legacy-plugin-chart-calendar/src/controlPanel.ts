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
  formatSelectOptions,
  sections,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'domain_granularity',
            config: {
              type: 'SelectControl',
              label: t('Domain'),
              default: 'month',
              choices: formatSelectOptions(['hour', 'day', 'week', 'month', 'year']),
              description: t('The time unit used for the grouping of blocks'),
            },
          },
          {
            name: 'subdomain_granularity',
            config: {
              type: 'SelectControl',
              label: t('Subdomain'),
              default: 'day',
              choices: formatSelectOptions(['min', 'hour', 'day', 'week', 'month']),
              description: t(
                'The time unit for each block. Should be a smaller unit than ' +
                  'domain_granularity. Should be larger or equal to Time Grain',
              ),
            },
          },
        ],
        ['metrics'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        ['linear_color_scheme'],
        [
          {
            name: 'cell_size',
            config: {
              type: 'TextControl',
              isInt: true,
              default: 10,
              validators: [legacyValidateInteger],
              renderTrigger: true,
              label: t('Cell Size'),
              description: t('The size of the square cell, in pixels'),
            },
          },
          {
            name: 'cell_padding',
            config: {
              type: 'TextControl',
              isInt: true,
              validators: [legacyValidateInteger],
              renderTrigger: true,
              default: 2,
              label: t('Cell Padding'),
              description: t('The distance between cells, in pixels'),
            },
          },
        ],
        [
          {
            name: 'cell_radius',
            config: {
              type: 'TextControl',
              isInt: true,
              validators: [legacyValidateInteger],
              renderTrigger: true,
              default: 0,
              label: t('Cell Radius'),
              description: t('The pixel radius'),
            },
          },
          {
            name: 'steps',
            config: {
              type: 'TextControl',
              isInt: true,
              validators: [legacyValidateInteger],
              renderTrigger: true,
              default: 10,
              label: t('Color Steps'),
              description: t('The number color "steps"'),
            },
          },
        ],
        [
          'y_axis_format',
          {
            name: 'x_axis_time_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Time Format'),
              renderTrigger: true,
              default: 'smart_date',
              choices: D3_TIME_FORMAT_OPTIONS,
              description: D3_FORMAT_DOCS,
            },
          },
        ],
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Legend'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display the legend (toggles)'),
            },
          },
          {
            name: 'show_values',
            config: {
              type: 'CheckboxControl',
              label: t('Show Values'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display the numerical values within the cells'),
            },
          },
        ],
        [
          {
            name: 'show_metric_name',
            config: {
              type: 'CheckboxControl',
              label: t('Show Metric Names'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display the metric name as a title'),
            },
          },
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
};

export default config;
