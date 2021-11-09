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
        ['entity'],
        [
          {
            name: 'country_fieldtype',
            config: {
              type: 'SelectControl',
              label: t('Country Field Type'),
              default: 'cca2',
              choices: [
                ['name', 'Full name'],
                ['cioc', 'code International Olympic Committee (cioc)'],
                ['cca2', 'code ISO 3166-1 alpha-2 (cca2)'],
                ['cca3', 'code ISO 3166-1 alpha-3 (cca3)'],
              ],
              description: t(
                'The country code standard that Superset should expect ' +
                  'to find in the [country] column',
              ),
            },
          },
        ],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
        [
          {
            name: 'sort_by_metric',
            config: {
              type: 'CheckboxControl',
              label: t('Sort by metric'),
              description: t(
                'Whether to sort results by the selected metric in descending order.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_bubbles',
            config: {
              type: 'CheckboxControl',
              label: t('Show Bubbles'),
              default: false,
              renderTrigger: true,
              description: t('Whether to display bubbles on top of countries'),
            },
          },
        ],
        ['secondary_metric'],
        [
          {
            name: 'max_bubble_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Max Bubble Size'),
              default: '25',
              choices: formatSelectOptions([
                '5',
                '10',
                '15',
                '25',
                '50',
                '75',
                '100',
              ]),
            },
          },
        ],
        ['color_picker'],
        ['linear_color_scheme'],
      ],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('Country Column'),
      description: t('3 letter code of the country'),
    },
    metric: {
      label: t('Metric for Color'),
      description: t('Metric that defines the color of the country'),
    },
    secondary_metric: {
      label: t('Bubble Size'),
      description: t('Metric that defines the size of the bubble'),
    },
    color_picker: {
      label: t('Bubble Color'),
    },
    linear_color_scheme: {
      label: t('Country Color Scheme'),
    },
  },
};

export default config;
