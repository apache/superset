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
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { ColorBy } from './utils';

const config: ControlPanelConfig = {
  controlPanelSections: [
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
                ['name', t('Full name')],
                ['cioc', t('code International Olympic Committee (cioc)')],
                ['cca2', t('code ISO 3166-1 alpha-2 (cca2)')],
                ['cca3', t('code ISO 3166-1 alpha-3 (cca3)')],
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
        ['sort_by_metric'],
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
        [
          {
            name: 'color_by',
            config: {
              type: 'RadioButtonControl',
              label: t('Color by'),
              default: ColorBy.Metric,
              options: [
                [ColorBy.Metric, t('Metric')],
                [ColorBy.Country, t('Country')],
              ],
              description: t(
                'Choose whether a country should be shaded by the metric, or assigned a color based on a categorical color palette',
              ),
            },
          },
        ],
        ['linear_color_scheme'],
        ['color_scheme'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [['y_axis_format'], ['currency_format']],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('Country Column'),
      description: t('3 letter code of the country'),
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
      visibility: ({ controls }) =>
        Boolean(controls?.color_by.value === ColorBy.Metric),
    },
    color_scheme: {
      label: t('Country Color Scheme'),
      visibility: ({ controls }) =>
        Boolean(controls?.color_by.value === ColorBy.Country),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
