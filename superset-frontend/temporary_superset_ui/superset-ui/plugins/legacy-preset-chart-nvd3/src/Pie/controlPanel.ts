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
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  D3_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import { showLegend } from '../NVD3Controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'pie_label_type',
            config: {
              type: 'SelectControl',
              label: t('Label Type'),
              default: 'key',
              renderTrigger: true,
              choices: [
                ['key', 'Category Name'],
                ['value', 'Value'],
                ['percent', 'Percentage'],
                ['key_value', 'Category and Value'],
                ['key_percent', 'Category and Percentage'],
                ['key_value_percent', 'Category, Value and Percentage'],
              ],
              description: t('What should be shown on the label?'),
            },
          },
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Number format'),
              renderTrigger: true,
              default: 'SMART_NUMBER',
              choices: D3_FORMAT_OPTIONS,
              description: `${t(
                'D3 format syntax: https://github.com/d3/d3-format',
              )} ${t(
                'Only applies when the "Label Type" is not set to a percentage.',
              )}`,
            },
          },
        ],
        [
          {
            name: 'donut',
            config: {
              type: 'CheckboxControl',
              label: t('Donut'),
              default: false,
              renderTrigger: true,
              description: t('Do you want a donut or a pie?'),
            },
          },
          showLegend,
        ],
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Labels'),
              renderTrigger: true,
              default: true,
              description: t(
                'Whether to display the labels. Note that the label only displays when the the 5% ' +
                  'threshold.',
              ),
            },
          },
          {
            name: 'labels_outside',
            config: {
              type: 'CheckboxControl',
              label: t('Put labels outside'),
              default: true,
              renderTrigger: true,
              description: t('Put the labels outside the pie?'),
            },
          },
        ],
        ['color_scheme'],
      ],
    },
  ],
  controlOverrides: {
    row_limit: {
      default: 25,
    },
  },
};

export default config;
