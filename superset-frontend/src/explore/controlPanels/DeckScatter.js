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
import timeGrainSqlaAnimationOverrides from './timeGrainSqlaAnimationOverrides';
import { nonEmpty } from '../validators';

export default {
  requiresTime: true,
  onInit: controlState => ({
    ...controlState,
    time_grain_sqla: {
      ...controlState.time_grain_sqla,
      value: null,
    },
    granularity: {
      ...controlState.granularity,
      value: null,
    },
  }),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['spatial', null],
        ['row_limit', 'filter_nulls'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        ['autozoom', null],
      ],
    },
    {
      label: t('Point Size'),
      controlSetRows: [
        [
          'point_radius_fixed',
          {
            name: 'point_unit',
            config: {
              type: 'SelectControl',
              label: t('Point Unit'),
              default: 'square_m',
              clearable: false,
              choices: [
                ['square_m', 'Square meters'],
                ['square_km', 'Square kilometers'],
                ['square_miles', 'Square miles'],
                ['radius_m', 'Radius in meters'],
                ['radius_km', 'Radius in kilometers'],
                ['radius_miles', 'Radius in miles'],
              ],
              description: t(
                'The unit of measure for the specified point radius',
              ),
            },
          },
        ],
        [
          {
            name: 'min_radius',
            config: {
              type: 'TextControl',
              label: t('Minimum Radius'),
              isFloat: true,
              validators: [nonEmpty],
              renderTrigger: true,
              default: 2,
              description: t(
                'Minimum radius size of the circle, in pixels. As the zoom level changes, this ' +
                  'insures that the circle respects this minimum radius.',
              ),
            },
          },
          {
            name: 'max_radius',
            config: {
              type: 'TextControl',
              label: t('Maximum Radius'),
              isFloat: true,
              validators: [nonEmpty],
              renderTrigger: true,
              default: 250,
              description: t(
                'Maxium radius size of the circle, in pixels. As the zoom level changes, this ' +
                  'insures that the circle respects this maximum radius.',
              ),
            },
          },
        ],
        ['multiplier', null],
      ],
    },
    {
      label: t('Point Color'),
      controlSetRows: [
        ['color_picker', 'legend_position'],
        [null, 'legend_format'],
        ['dimension', 'color_scheme', 'label_colors'],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        ['js_columns'],
        ['js_data_mutator'],
        ['js_tooltip'],
        ['js_onclick_href'],
      ],
    },
  ],
  controlOverrides: {
    dimension: {
      label: t('Categorical Color'),
      description: t(
        'Pick a dimension from which categorical colors are defined',
      ),
    },
    size: {
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
};
