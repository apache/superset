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
import { t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  formatSelectOptionsForRange,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

const sortAxisChoices = [
  ['alpha_asc', t('Axis ascending')],
  ['alpha_desc', t('Axis descending')],
  ['value_asc', t('Metric ascending')],
  ['value_desc', t('Metric descending')],
];

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
        [
          {
            name: 'sort_x_axis',
            config: {
              type: 'SelectControl',
              label: t('Sort X Axis'),
              choices: sortAxisChoices,
              renderTrigger: false,
              clearable: true,
            },
          },
        ],
        [
          {
            name: 'sort_y_axis',
            config: {
              type: 'SelectControl',
              label: t('Sort Y Axis'),
              choices: sortAxisChoices,
              renderTrigger: false,
              clearable: true,
            },
          },
        ],
        [
          {
            name: 'normalize_across',
            config: {
              type: 'SelectControl',
              label: t('Normalize Across'),
              choices: [
                ['heatmap', t('heatmap')],
                ['x', t('x')],
                ['y', t('y')],
              ],
              default: 'heatmap',
              renderTrigger: false,
              description: (
                <>
                  <div>
                    {t(
                      'Color will be shaded based the normalized (0% to 100%) value of a given cell against the other cells in the selected range: ',
                    )}
                  </div>
                  <ul>
                    <li>{t('x: values are normalized within each column')}</li>
                    <li>{t('y: values are normalized within each row')}</li>
                    <li>
                      {t(
                        'heatmap: values are normalized across the entire heatmap',
                      )}
                    </li>
                  </ul>
                </>
              ),
            },
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
            name: 'legend_type',
            config: {
              type: 'SelectControl',
              label: t('Legend Type'),
              renderTrigger: true,
              choices: [
                ['continuous', t('Continuous')],
                ['piecewise', t('Piecewise')],
              ],
              default: 'continuous',
              clearable: false,
            },
          },
        ],
        ['linear_color_scheme'],
        [
          {
            name: 'border_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Border color'),
              renderTrigger: true,
              description: t('The color of the elements border'),
              default: { r: 0, g: 0, b: 0, a: 1 },
            },
          },
          {
            name: 'border_width',
            config: {
              type: 'SliderControl',
              label: t('Border width'),
              renderTrigger: true,
              min: 0,
              max: 2,
              default: 0,
              step: 0.1,
              description: t('The width of the elements border'),
            },
          },
        ],
        [
          {
            name: 'xscale_interval',
            config: {
              type: 'SelectControl',
              label: t('XScale Interval'),
              renderTrigger: true,
              choices: [[-1, t('Auto')]].concat(
                formatSelectOptionsForRange(1, 50),
              ),
              default: -1,
              clearable: false,
              description: t(
                'Number of steps to take between ticks when displaying the X scale',
              ),
            },
          },
        ],
        [
          {
            name: 'yscale_interval',
            config: {
              type: 'SelectControl',
              label: t('YScale Interval'),
              choices: [[-1, t('Auto')]].concat(
                formatSelectOptionsForRange(1, 50),
              ),
              default: -1,
              clearable: false,
              renderTrigger: true,
              description: t(
                'Number of steps to take between ticks when displaying the Y scale',
              ),
            },
          },
        ],
        [
          {
            name: 'left_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: false,
              label: t('Left Margin'),
              choices: [
                ['auto', t('Auto')],
                [50, '50'],
                [75, '75'],
                [100, '100'],
                [125, '125'],
                [150, '150'],
                [200, '200'],
              ],
              default: 'auto',
              renderTrigger: true,
              description: t(
                'Left margin, in pixels, allowing for more room for axis labels',
              ),
            },
          },
        ],
        [
          {
            name: 'bottom_margin',
            config: {
              type: 'SelectControl',
              clearable: false,
              freeForm: true,
              label: t('Bottom Margin'),
              choices: [
                ['auto', t('Auto')],
                [50, '50'],
                [75, '75'],
                [100, '100'],
                [125, '125'],
                [150, '150'],
                [200, '200'],
              ],
              default: 'auto',
              renderTrigger: true,
              description: t(
                'Bottom margin, in pixels, allowing for more room for axis labels',
              ),
            },
          },
        ],
        [
          {
            name: 'value_bounds',
            config: {
              type: 'BoundsControl',
              label: t('Value bounds'),
              renderTrigger: true,
              default: [null, null],
              description: t('Hard value bounds applied for color coding.'),
            },
          },
        ],
        ['y_axis_format'],
        ['x_axis_time_format'],
        ['currency_format'],
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
        ],
        [
          {
            name: 'show_percentage',
            config: {
              type: 'CheckboxControl',
              label: t('Show percentage'),
              renderTrigger: true,
              description: t(
                'Whether to include the percentage in the tooltip',
              ),
              default: true,
            },
          },
        ],
        [
          {
            name: 'show_values',
            config: {
              type: 'CheckboxControl',
              label: t('Show Values'),
              renderTrigger: true,
              default: false,
              description: t(
                'Whether to display the numerical values within the cells',
              ),
            },
          },
        ],
        [
          {
            name: 'normalized',
            config: {
              type: 'CheckboxControl',
              label: t('Normalized'),
              renderTrigger: true,
              description: t(
                'Whether to apply a normal distribution based on rank on the color scale',
              ),
              default: false,
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Y-Axis'),
      description: t('Dimension to use on y-axis.'),
      multi: false,
      validators: [validateNonEmpty],
    },
    y_axis_format: {
      label: t('Value Format'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
