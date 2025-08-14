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
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';

/**
 * Modern Pie Chart Control Panel using the existing control infrastructure
 * This version creates individual control items that work with the current system
 */
const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: sharedControls.groupby || {},
          },
        ],
        [
          {
            name: 'metric',
            config: sharedControls.metrics || {},
          },
        ],
        [
          {
            name: 'adhoc_filters',
            config: sharedControls.adhoc_filters || {},
          },
        ],
        [
          {
            name: 'row_limit',
            config: {
              ...sharedControls.row_limit,
              default: 100,
            },
          },
        ],
        [
          {
            name: 'sort_by_metric',
            config: sharedControls.sort_by_metric || {},
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'color_scheme',
            config: sharedControls.color_scheme || {},
          },
        ],
        [
          {
            name: 'show_labels_threshold',
            config: {
              type: 'TextControl',
              label: t('Percentage threshold'),
              renderTrigger: true,
              isFloat: true,
              default: 5,
              description: t(
                'Minimum threshold in percentage points for showing labels.',
              ),
            },
          },
          {
            name: 'threshold_for_other',
            config: {
              type: 'TextControl',
              label: t('Threshold for Other'),
              renderTrigger: true,
              isFloat: true,
              default: 0,
              description: t(
                'Values less than this percentage will be grouped into the Other category.',
              ),
            },
          },
        ],
        [
          {
            name: 'roseType',
            config: {
              type: 'SelectControl',
              label: t('Rose Type'),
              description: t('Whether to show as Nightingale chart.'),
              renderTrigger: true,
              choices: [
                ['area', t('Area')],
                ['radius', t('Radius')],
                [null, t('None')],
              ],
              default: null,
              clearable: false,
            },
          },
        ],
      ],
    },
    {
      label: t('Labels'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'label_type',
            config: {
              type: 'SelectControl',
              label: t('Label Type'),
              default: 'key',
              renderTrigger: true,
              choices: [
                ['key', t('Category Name')],
                ['value', t('Value')],
                ['percent', t('Percentage')],
                ['key_value', t('Category and Value')],
                ['key_percent', t('Category and Percentage')],
                ['key_value_percent', t('Category, Value and Percentage')],
                ['value_percent', t('Value and Percentage')],
                ['template', t('Template')],
              ],
              description: t('What should be shown on the label?'),
              clearable: false,
            },
          },
        ],
        [
          {
            name: 'label_template',
            config: {
              type: 'TextControl',
              label: t('Label Template'),
              renderTrigger: true,
              description: t(
                'Format data labels. Use variables: {name}, {value}, {percent}.',
              ),
              visibility: ({ controls }) =>
                controls?.label_type?.value === 'template',
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
              default: 'SMART_NUMBER',
              choices: D3_FORMAT_OPTIONS,
              description: D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
            },
          },
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
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Labels'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.showLabels,
              description: t('Whether to display the labels.'),
            },
          },
          {
            name: 'labels_outside',
            config: {
              type: 'CheckboxControl',
              label: t('Put labels outside'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.labelsOutside,
              description: t('Put the labels outside of the pie?'),
            },
          },
          {
            name: 'label_line',
            config: {
              type: 'CheckboxControl',
              label: t('Label Line'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.labelLine,
              description: t(
                'Draw line from Pie to label when labels outside?',
              ),
            },
          },
        ],
        [
          {
            name: 'show_total',
            config: {
              type: 'CheckboxControl',
              label: t('Show Total'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display the aggregate count'),
            },
          },
        ],
      ],
    },
    {
      label: t('Pie shape'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'outerRadius',
            config: {
              type: 'SliderControl',
              label: t('Outer Radius'),
              renderTrigger: true,
              min: 10,
              max: 100,
              step: 1,
              default: DEFAULT_FORM_DATA.outerRadius,
              description: t('Outer edge of Pie chart'),
            },
          },
        ],
        [
          {
            name: 'donut',
            config: {
              type: 'CheckboxControl',
              label: t('Donut'),
              renderTrigger: true,
              default: DEFAULT_FORM_DATA.donut,
              description: t('Do you want a donut or a pie?'),
            },
          },
        ],
        [
          {
            name: 'innerRadius',
            config: {
              type: 'SliderControl',
              label: t('Inner Radius'),
              renderTrigger: true,
              min: 0,
              max: 100,
              step: 1,
              default: DEFAULT_FORM_DATA.innerRadius,
              description: t('Inner radius of donut hole'),
              visibility: ({ controls }) => Boolean(controls?.donut?.value),
            },
          },
        ],
      ],
    },
    {
      label: t('Legend'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Show legend'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display a legend for the chart'),
            },
          },
        ],
        [
          {
            name: 'legendType',
            config: {
              type: 'SelectControl',
              label: t('Legend type'),
              renderTrigger: true,
              choices: [
                ['scroll', t('Scroll')],
                ['plain', t('Plain')],
              ],
              default: 'scroll',
              clearable: false,
              description: t('Legend type'),
              visibility: ({ controls }) =>
                Boolean(controls?.show_legend?.value),
            },
          },
          {
            name: 'legendOrientation',
            config: {
              type: 'SelectControl',
              label: t('Legend orientation'),
              renderTrigger: true,
              choices: [
                ['top', t('Top')],
                ['bottom', t('Bottom')],
                ['left', t('Left')],
                ['right', t('Right')],
              ],
              default: 'top',
              clearable: false,
              description: t('Legend orientation'),
              visibility: ({ controls }) =>
                Boolean(controls?.show_legend?.value),
            },
          },
        ],
        [
          {
            name: 'legendMargin',
            config: {
              type: 'TextControl',
              label: t('Legend margin'),
              renderTrigger: true,
              isInt: true,
              default: 0,
              description: t(
                'Additional margin to add between legend and chart',
              ),
              visibility: ({ controls }) =>
                Boolean(controls?.show_legend?.value),
            },
          },
        ],
      ],
    },
  ],
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
    groupby: getStandardizedControls().popAllColumns(),
    row_limit: formData.row_limit ?? 100,
  }),
};

export default config;
