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
        ['time_grain_sqla'],
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
      ],
    },
    {
      label: t('Series settings'),
      expanded: true,
      controlSetRows: [
        [
          <ControlSubSectionHeader>
            {t('Series increase setting')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'increase_color',
            config: {
              label: t('Increase color'),
              type: 'ColorPickerControl',
              default: { r: 90, g: 193, b: 137, a: 1 },
              renderTrigger: true,
              description: t(
                'Select the color used for values that indicate an increase in the chart',
              ),
            },
          },
          {
            name: 'increase_label',
            config: {
              label: t('Increase label'),
              type: 'TextControl',
              renderTrigger: true,
              description: t(
                'Customize the label displayed for increasing values in the chart tooltips and legend.',
              ),
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('Series decrease setting')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'decrease_color',
            config: {
              label: t('Decrease color'),
              type: 'ColorPickerControl',
              default: { r: 224, g: 67, b: 85, a: 1 },
              renderTrigger: true,
              description: t(
                'Select the color used for values ​​that indicate a decrease in the chart.',
              ),
            },
          },
          {
            name: 'decrease_label',
            config: {
              label: t('Decrease label'),
              type: 'TextControl',
              renderTrigger: true,
              description: t(
                'Customize the label displayed for decreasing values in the chart tooltips and legend.',
              ),
            },
          },
        ],
        [
          <ControlSubSectionHeader>
            {t('Series total setting')}
          </ControlSubSectionHeader>,
        ],
        [
          {
            name: 'total_color',
            config: {
              label: t('Total color'),
              type: 'ColorPickerControl',
              default: { r: 102, g: 102, b: 102, a: 1 },
              renderTrigger: true,
              description: t(
                'Select the color used for values that represent total bars in the chart',
              ),
            },
          },

          {
            name: 'total_label',
            config: {
              label: t('Total label'),
              type: 'TextControl',
              renderTrigger: true,
              description: t(
                'Customize the label displayed for total values in the chart tooltips, legend, and chart axis.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'x_axis_label',
            config: {
              type: 'TextControl',
              label: t('X Axis Label'),
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
              label: t('X Tick Layout'),
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
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'y_axis_label',
            config: {
              type: 'TextControl',
              label: t('Y Axis Label'),
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
