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
import { FeatureFlag, isFeatureEnabled, t, validateNonEmpty } from '@superset-ui/core';
import {
  columnChoices,
  ControlPanelConfig,
  ControlPanelState,
  formatSelectOptions,
  formatSelectOptionsForRange,
  sections,
} from '@superset-ui/chart-controls';
import { dndEntity } from '@superset-ui/chart-controls/lib/shared-controls/dndControls';

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
  ...dndEntity,
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
              label: 'X Axis',
            },
          },
        ],
        [
          {
            name: 'all_columns_y',
            config: {
              ...columnsConfig,
              label: 'Y Axis',
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
              description: t('Whether to sort results by the selected metric in descending order.'),
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
              default: '1',
              clearable: false,
              description: t('Number of steps to take between ticks when displaying the X scale'),
            },
          },
          {
            name: 'yscale_interval',
            config: {
              type: 'SelectControl',
              label: t('YScale Interval'),
              choices: formatSelectOptionsForRange(1, 50),
              default: '1',
              clearable: false,
              renderTrigger: true,
              description: t('Number of steps to take between ticks when displaying the Y scale'),
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
                ['pixelated', 'pixelated (Sharp)'],
                ['auto', 'auto (Smooth)'],
              ],
              default: 'pixelated',
              description: t(
                'image-rendering CSS attribute of the canvas object that ' +
                  'defines how the browser scales up the image',
              ),
            },
          },
          {
            name: 'normalize_across',
            config: {
              type: 'SelectControl',
              label: t('Normalize Across'),
              choices: [
                ['heatmap', 'heatmap'],
                ['x', 'x'],
                ['y', 'y'],
              ],
              default: 'heatmap',
              description: t(
                'Color will be rendered based on a ratio ' +
                  'of the cell against the sum of across this ' +
                  'criteria',
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
              choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
              default: 'auto',
              renderTrigger: true,
              description: t('Left margin, in pixels, allowing for more room for axis labels'),
            },
          },
          {
            name: 'bottom_margin',
            config: {
              type: 'SelectControl',
              clearable: false,
              freeForm: true,
              label: t('Bottom Margin'),
              choices: formatSelectOptions(['auto', 50, 75, 100, 125, 150, 200]),
              default: 'auto',
              renderTrigger: true,
              description: t('Bottom margin, in pixels, allowing for more room for axis labels'),
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
          'y_axis_format',
        ],
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Legend'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display the legend (toggles)'),
            },
          },
          {
            name: 'show_perc',
            config: {
              type: 'CheckboxControl',
              label: t('Show percentage'),
              renderTrigger: true,
              description: t('Whether to include the percentage in the tooltip'),
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
              description: t('Whether to display the numerical values within the cells'),
            },
          },
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
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Value Format'),
    },
  },
};

export default config;
