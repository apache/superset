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
  FeatureFlag,
  isFeatureEnabled,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  columnChoices,
  ControlPanelConfig,
  ControlPanelState,
  formatSelectOptionsForRange,
  sections,
  sharedControls,
  getStandardizedControls,
  D3_TIME_FORMAT_DOCS,
} from '@superset-ui/chart-controls';

const sortAxisChoices = [
  ['alpha_asc', t('Axis ascending')],
  ['alpha_desc', t('Axis descending')],
  ['value_asc', t('Metric ascending')],
  ['value_desc', t('Metric descending')],
];

const allColumns = {
  type: 'SelectControl',
  default: null,
  description: t('Columns to display'),
  mapStateToProps: (state: ControlPanelState) => ({
    choices: columnChoices(state.datasource),
  }),
  validators: [validateNonEmpty],
};

const dndAllColumns = {
  ...sharedControls.entity,
  description: t('Columns to display'),
};

const columnsConfig = isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
  ? dndAllColumns
  : allColumns;

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'all_columns_x',
            config: {
              ...columnsConfig,
              label: t('X Axis'),
            },
          },
        ],
        [
          {
            name: 'all_columns_y',
            config: {
              ...columnsConfig,
              label: t('Y Axis'),
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
      label: t('Heatmap Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        ['linear_color_scheme'],
        [
          {
            name: 'xscale_interval',
            config: {
              type: 'SelectControl',
              label: t('XScale Interval'),
              renderTrigger: true,
              choices: formatSelectOptionsForRange(1, 50),
              default: 1,
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
              choices: formatSelectOptionsForRange(1, 50),
              default: 1,
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
            name: 'canvas_image_rendering',
            config: {
              type: 'SelectControl',
              label: t('Rendering'),
              renderTrigger: true,
              choices: [
                ['pixelated', t('pixelated (Sharp)')],
                ['auto', t('auto (Smooth)')],
              ],
              default: 'pixelated',
              description: t(
                'image-rendering CSS attribute of the canvas object that ' +
                  'defines how the browser scales up the image',
              ),
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
        [
          {
            name: 'left_margin',
            config: {
              type: 'SelectControl',
              freeForm: true,
              clearable: false,
              label: t('Left Margin'),
              choices: [
                ['auto', t('auto')],
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
                ['auto', t('auto')],
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
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: t('Value bounds'),
              renderTrigger: true,
              default: [null, null],
              description: t(
                'Hard value bounds applied for color coding. Is only relevant ' +
                  'and applied when the normalization is applied against the whole heatmap.',
              ),
            },
          },
        ],
        ['y_axis_format'],
        [
          {
            name: 'time_format',
            config: {
              ...sharedControls.x_axis_time_format,
              default: '%d/%m/%Y',
              description: `${D3_TIME_FORMAT_DOCS}.`,
            },
          },
        ],
        ['currency_format'],
        [
          {
            name: 'sort_x_axis',
            config: {
              type: 'SelectControl',
              label: t('Sort X Axis'),
              choices: sortAxisChoices,
              clearable: false,
              default: 'alpha_asc',
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
              clearable: false,
              default: 'alpha_asc',
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
        ],
        [
          {
            name: 'show_perc',
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
