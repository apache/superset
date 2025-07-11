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
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { t, validateNonEmpty, legacyValidateInteger } from '@superset-ui/core';
import timeGrainSqlaAnimationOverrides, {
  columnChoices,
  PRIMARY_COLOR,
} from '../../utilities/controls';
import {
  COLOR_SCHEME_TYPES,
  formatSelectOptions,
  isColorSchemeTypeVisible,
} from '../../utilities/utils';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  legendFormat,
  legendPosition,
  viewport,
  mapboxStyle,
  deckGLCategoricalColor,
  deckGLCategoricalColorSchemeSelect,
  deckGLCategoricalColorSchemeTypeSelect,
} from '../../utilities/Shared_DeckGL';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'start_spatial',
            config: {
              type: 'SpatialControl',
              label: t('Start Longitude & Latitude'),
              validators: [validateNonEmpty],
              description: t('Point to your spatial columns'),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
          {
            name: 'end_spatial',
            config: {
              type: 'SpatialControl',
              label: t('End Longitude & Latitude'),
              validators: [validateNonEmpty],
              description: t('Point to your spatial columns'),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
        ],
        ['row_limit', filterNulls],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [[mapboxStyle], [autozoom, viewport]],
    },
    {
      label: t('Arc'),
      controlSetRows: [
        [
          {
            name: 'color_scheme_type',
            config: {
              ...deckGLCategoricalColorSchemeTypeSelect.config,
              choices: [
                [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
                [
                  COLOR_SCHEME_TYPES.categorical_palette,
                  t('Categorical palette'),
                ],
              ],
              default: COLOR_SCHEME_TYPES.fixed_color,
            },
          },
        ],
        [
          {
            name: 'color_picker',
            config: {
              label: t('Source Color'),
              description: t('Color of the source location'),
              type: 'ColorPickerControl',
              default: PRIMARY_COLOR,
              renderTrigger: true,
              visibility: ({ controls }) =>
                isColorSchemeTypeVisible(
                  controls,
                  COLOR_SCHEME_TYPES.fixed_color,
                ),
            },
          },
          {
            name: 'target_color_picker',
            config: {
              label: t('Target Color'),
              description: t('Color of the target location'),
              type: 'ColorPickerControl',
              default: PRIMARY_COLOR,
              renderTrigger: true,
              visibility: ({ controls }) =>
                isColorSchemeTypeVisible(
                  controls,
                  COLOR_SCHEME_TYPES.fixed_color,
                ),
            },
          },
        ],
        [deckGLCategoricalColor],
        [deckGLCategoricalColorSchemeSelect],
        [
          {
            name: 'stroke_width',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Stroke Width'),
              validators: [legacyValidateInteger],
              default: null,
              renderTrigger: true,
              choices: formatSelectOptions([1, 2, 3, 4, 5]),
            },
          },
        ],
        [legendPosition],
        [legendFormat],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        [jsColumns],
        [jsDataMutator],
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
  controlOverrides: {
    size: {
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
};

export default config;
