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
import { validateNonEmpty } from '@superset-ui/core';
import { t } from '@apache-superset/core';
import {
  ControlPanelConfig,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';
import {
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  mapboxStyle,
  viewport,
  autozoom,
  tooltipContents,
  tooltipTemplate,
  deckGLCategoricalColorSchemeTypeSelect,
  deckGLLinearColorSchemeSelect,
  deckGLColorBreakpointsSelect,
  breakpointsDefaultColor,
  fillColorPicker,
} from '../../utilities/Shared_DeckGL';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'h3_index',
            config: {
              ...sharedControls.groupby,
              label: t('H3 Column'),
              description: t('The column containing H3 hexagon indices'),
              multi: false,
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'metric',
            config: {
              ...sharedControls.metric,
              label: t('Metric'),
              description: t('Metric for hexagon elevation/color'),
            },
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
        [jsColumns],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [[mapboxStyle], [autozoom, viewport]],
    },
    {
      label: t('Visual'),
      controlSetRows: [
        [
          {
            name: 'extruded',
            config: {
              type: 'CheckboxControl',
              label: t('Extruded (3D)'),
              default: true,
              description: t('Whether to extrude hexagons in 3D'),
            },
          },
        ],
        [
          {
            name: 'coverage',
            config: {
              type: 'SliderControl',
              label: t('Coverage'),
              default: 1,
              min: 0,
              max: 1,
              step: 0.05,
              description: t('Hexagon size multiplier (0-1)'),
            },
          },
        ],
        [
          {
            name: 'elevation_scale',
            config: {
              type: 'SliderControl',
              label: t('Elevation Scale'),
              default: 1,
              min: 0,
              max: 100,
              step: 1,
              description: t('Multiplier for hexagon elevation'),
            },
          },
        ],
        [
          {
            ...deckGLCategoricalColorSchemeTypeSelect,
            config: {
              ...deckGLCategoricalColorSchemeTypeSelect.config,
              choices: [
                [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
                [COLOR_SCHEME_TYPES.linear_palette, t('Linear palette')],
                [COLOR_SCHEME_TYPES.color_breakpoints, t('Color breakpoints')],
              ],
              default: COLOR_SCHEME_TYPES.linear_palette,
            },
          },
          fillColorPicker,
          deckGLLinearColorSchemeSelect,
          breakpointsDefaultColor,
          deckGLColorBreakpointsSelect,
        ],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [[jsDataMutator], [jsTooltip], [jsOnclickHref]],
    },
  ],
};

export default config;
