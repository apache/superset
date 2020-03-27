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
import { t } from '@superset-ui/translation';
import { nonEmpty } from '../validators';
import { formatSelectOptionsForRange } from '../../modules/utils';

const sortAxisChoices = [
  ['alpha_asc', t('Axis ascending')],
  ['alpha_desc', t('Axis descending')],
  ['value_asc', t('Metric ascending')],
  ['value_desc', t('Metric descending')],
];

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x', 'all_columns_y'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Heatmap Options'),
      expanded: true,
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
              description: t(
                'Number of steps to take between ticks when displaying the X scale',
              ),
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
          'normalize_across',
        ],
        ['left_margin', 'bottom_margin'],
        ['y_axis_bounds', 'y_axis_format'],
        [
          'show_legend',
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
        ['show_values', 'normalized'],
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
    all_columns_x: {
      validators: [nonEmpty],
    },
    all_columns_y: {
      validators: [nonEmpty],
    },
    normalized: t(
      'Whether to apply a normal distribution based on rank on the color scale',
    ),
    y_axis_bounds: {
      label: t('Value bounds'),
      renderTrigger: true,
      description: t(
        'Hard value bounds applied for color coding. Is only relevant ' +
          'and applied when the normalization is applied against the whole heatmap.',
      ),
    },
    y_axis_format: {
      label: t('Value Format'),
    },
  },
};
