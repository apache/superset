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
import {
  ControlPanelConfig,
  AdhocFiltersControl,
  RowLimitControl,
  SpatialControl,
  InlineColorPickerControl as ColorPickerControl,
  InlineSelectControl as SelectControl,
} from '@superset-ui/chart-controls';
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
          SpatialControl({
            name: 'start_spatial',
            label: t('Start Longitude & Latitude'),
            validators: [validateNonEmpty],
            description: t('Point to your spatial columns'),
            mapStateToProps: state => ({
              choices: columnChoices(state.datasource),
            }),
          }),
          SpatialControl({
            name: 'end_spatial',
            label: t('End Longitude & Latitude'),
            validators: [validateNonEmpty],
            description: t('Point to your spatial columns'),
            mapStateToProps: state => ({
              choices: columnChoices(state.datasource),
            }),
          }),
        ],
        [RowLimitControl(), filterNulls],
        [AdhocFiltersControl()],
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
          ColorPickerControl({
            name: 'color_picker',
            label: t('Source Color'),
            description: t('Color of the source location'),
            default: PRIMARY_COLOR,
            renderTrigger: true,
            visibility: ({ controls }: any) =>
              isColorSchemeTypeVisible(
                controls,
                COLOR_SCHEME_TYPES.fixed_color,
              ),
          }),
          ColorPickerControl({
            name: 'target_color_picker',
            label: t('Target Color'),
            description: t('Color of the target location'),
            default: PRIMARY_COLOR,
            renderTrigger: true,
            visibility: ({ controls }: any) =>
              isColorSchemeTypeVisible(
                controls,
                COLOR_SCHEME_TYPES.fixed_color,
              ),
          }),
        ],
        [deckGLCategoricalColor],
        [deckGLCategoricalColorSchemeSelect],
        [
          SelectControl({
            name: 'stroke_width',
            freeForm: true,
            label: t('Stroke Width'),
            validators: [legacyValidateInteger],
            default: null,
            renderTrigger: true,
            choices: formatSelectOptions([1, 2, 3, 4, 5]),
          }),
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
