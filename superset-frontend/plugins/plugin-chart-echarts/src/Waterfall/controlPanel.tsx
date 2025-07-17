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
  ControlSubSectionHeader,
  D3_TIME_FORMAT_DOCS,
  DEFAULT_TIME_FORMAT,
  formatSelectOptions,
  sharedControls,
} from '@superset-ui/chart-controls';
import { showValueControl } from '../controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['x_axis'],
        [
          {
            name: 'xAxisSortByColumn',
            config: {
              type: 'SelectControl',
              label: t('X axis sort by column'),
              description: t(
                'Column to use for ordering the waterfall based on a column',
              ),
              mapStateToProps: state => ({
                choices: [
                  ...(state.datasource?.columns || []).map(col => [
                    col.column_name,
                    col.column_name,
                  ]),
                ],
                default: '',
              }),
              renderTrigger: false,
              clearable: true,
              visibility: ({ controls }) => Boolean(controls?.x_axis?.value),
            },
          },
        ],
        [
          {
            name: 'xAxisSortByColumnOrder',
            config: {
              type: 'SelectControl',
              label: t('X axis sort by column order direction'),
              choices: [
                ['NONE', t('None')],
                ['ASC', t('Ascending')],
                ['DESC', t('Descending')],
              ],
              default: 'NONE',
              clearable: false,
              description: t(
                'Ordering direction for the series, to be used with "Order series by column"',
              ),
              visibility: ({ controls }) =>
                Boolean(controls?.xAxisSortByColumn?.value),
            },
          },
        ],
        ['time_grain_sqla'],
        ['groupby'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart options'),
      expanded: true,
      controlSetRows: [
        [showValueControl],
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Show legend'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display a legend for the chart'),
            },
          },
        ],
        [
          {
            name: 'show_total',
            config: {
              type: 'CheckboxControl',
              label: t('Show total'),
              default: true,
              renderTrigger: true,
              description: t('Show the total value in the waterfall chart'),
            },
          },
        ],
        [
          {
            name: 'useFirstValueAsSubtotal',
            config: {
              type: 'CheckboxControl',
              label: t('Use first value as subtotal'),
              default: false,
              renderTrigger: true,
              description: t('Render the first bar in the chart as a subtotal'),
            },
          },
        ],
        [
          {
            name: 'bold_labels',
            config: {
              type: 'SelectControl',
              label: t('Bold labels'),
              default: 'both',
              choices: [
                ['none', t('None')],
                ['total', t('Total only')],
                ['subtotal', t('Subtotal only')],
                ['both', t('Both total and subtotal')],
              ],
              renderTrigger: true,
              description: t(
                'Choose which labels to display in bold in the waterfall chart',
              ),
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('Series colors')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'increase_color',
            config: {
              label: t('Increase'),
              type: 'ColorPickerControl',
              default: { r: 90, g: 193, b: 137, a: 1 },
              renderTrigger: true,
            },
          },
          {
            name: 'decrease_color',
            config: {
              label: t('Decrease'),
              type: 'ColorPickerControl',
              default: { r: 224, g: 67, b: 85, a: 1 },
              renderTrigger: true,
            },
          },
          {
            name: 'total_color',
            config: {
              label: t('Total'),
              type: 'ColorPickerControl',
              default: { r: 102, g: 102, b: 102, a: 1 },
              renderTrigger: true,
            },
          },
        ],
        [<ControlSubSectionHeader>{t('X axis')}</ControlSubSectionHeader>],
        [
          {
            name: 'x_axis_label',
            config: {
              type: 'TextControl',
              label: t('X axis label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'x_axis_time_format',
            config: {
              ...sharedControls.x_axis_time_format,
              default: DEFAULT_TIME_FORMAT,
              description: `${D3_TIME_FORMAT_DOCS}.`,
            },
          },
        ],
        [
          {
            name: 'x_ticks_layout',
            config: {
              type: 'SelectControl',
              label: t('X tick layout'),
              choices: formatSelectOptions([
                'auto',
                'flat',
                '45°',
                '90°',
                'staggered',
              ]),
              default: 'auto',
              clearable: false,
              renderTrigger: true,
              description: t('The way the ticks are laid out on the X-axis'),
            },
          },
        ],
        [
          {
            name: 'orientation',
            config: {
              type: 'SelectControl',
              label: t('Orientation'),
              default: 'vertical',
              choices: [
                ['vertical', t('Vertical')],
                ['horizontal', t('Horizontal')],
              ],
              renderTrigger: true,
              description: t('Orientation of the chart'),
            },
          },
        ],
        [<ControlSubSectionHeader>{t('Y axis')}</ControlSubSectionHeader>],
        [
          {
            name: 'y_axis_label',
            config: {
              type: 'TextControl',
              label: t('Y axis label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        ['y_axis_format'],
        ['currency_format'],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Breakdowns'),
      description:
        t(`Breaks down the series by the category specified in this control.
      This can help viewers understand how each category affects the overall value.`),
      multi: false,
    },
  },
};

export default config;
