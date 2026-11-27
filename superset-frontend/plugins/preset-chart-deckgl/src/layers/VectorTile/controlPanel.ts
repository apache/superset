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

import { t } from '@apache-superset/core/translation';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ControlPanelConfig,
  ControlPanelState,
  ColumnMeta,
} from '@superset-ui/chart-controls';
import { validateInteger } from '@superset-ui/core';
import TilePropertyControl from './TilePropertyControl';
import {
  deckGLCategoricalColorSchemeSelect,
  deckGLCategoricalColorSchemeTypeSelect,
  fillColorPicker,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  tooltipTemplate,
  viewport,
  breakpointsDefaultColor,
  deckGLColorBreakpointsSelect,
} from '../../utilities/Shared_DeckGL';

import { columnChoices } from '../../utilities/controls';

import {
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  isTileUrlTemplate,
} from './layerSettings';

import {
  COLOR_SCHEME_TYPES,
  isColorSchemeTypeVisible,
} from '../../utilities/utils';

/** Returns an error message unless the value is a URL template with {z}, {x} and {y}. */
export const validateTileUrl = (value: unknown): string | false =>
  isTileUrlTemplate(value) ? false : t('must contain {z}, {x} and {y}');

/** Gives a TilePropertyControl the TileJSON settings and dataset columns. */
const tilePropertyControlState = (state: ControlPanelState) => ({
  tileJsonUrl: (state.controls?.tile_json_url?.value ??
    state.form_data?.tile_json_url) as string | undefined,
  sourceLayer: (state.controls?.source_layer?.value ??
    state.form_data?.source_layer) as string | undefined,
  datasetChoices: columnChoices(state.datasource),
});

/** Like tilePropertyControlState, but lists only numeric properties (for breakpoints). */
const numericPropertyControlState = (state: ControlPanelState) => {
  const baseProps = tilePropertyControlState(state);
  const numericColumns = new Set(
    ((state.datasource?.columns ?? []) as ColumnMeta[])
      .filter(column => column.type_generic === GenericDataType.Numeric)
      .map(column => column.column_name),
  );
  return {
    ...baseProps,
    numericOnly: true,
    datasetChoices: baseProps.datasetChoices.filter(([name]) =>
      numericColumns.has(name),
    ),
  };
};

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Tile source'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'tile_url',
            config: {
              type: 'TextControl',
              label: t('Tile URL'),
              description: t(
                'URL template of the vector tile server, e.g. http://localhost:3000/places/{z}/{x}/{y}',
              ),
              default: '',
              renderTrigger: true,
              validators: [validateTileUrl],
            },
          },
        ],
        [
          {
            name: 'tile_json_url',
            config: {
              type: 'TextControl',
              label: t('TileJSON URL'),
              description: t(
                "Optional. Address of the tile server's TileJSON, e.g. http://localhost:3000/places. Used to list the properties the tiles contain; without it, the dataset's columns are listed.",
              ),
              default: '',
              renderTrigger: true,
              rerender: [
                'tooltip_properties',
                'color_property',
                'breakpoint_property',
              ],
            },
          },
        ],
        [
          {
            name: 'source_layer',
            config: {
              type: 'TextControl',
              label: t('Source layer'),
              description: t(
                'Name of the layer inside each tile to draw. Leave empty to draw every layer.',
              ),
              default: '',
              renderTrigger: true,
              rerender: [
                'tooltip_properties',
                'color_property',
                'breakpoint_property',
              ],
            },
          },
        ],
        [
          {
            name: 'min_zoom',
            config: {
              type: 'TextControl',
              isInt: true,
              label: t('Min zoom'),
              description: t(
                'Lowest zoom level the tile server has tiles for.',
              ),
              default: DEFAULT_MIN_ZOOM,
              renderTrigger: true,
              validators: [validateInteger],
            },
          },
          {
            name: 'max_zoom',
            config: {
              type: 'TextControl',
              isInt: true,
              label: t('Max zoom'),
              description: t(
                'Highest zoom level the tile server has tiles for. When zoomed in further, these tiles are enlarged instead of fetching new ones.',
              ),
              default: DEFAULT_MAX_ZOOM,
              renderTrigger: true,
              validators: [validateInteger],
            },
          },
        ],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapProvider],
        [mapboxStyle],
        [maplibreStyle],
        [viewport],
      ],
    },
    {
      label: t('Layer style'),
      expanded: true,
      controlSetRows: [
        [
          {
            ...deckGLCategoricalColorSchemeTypeSelect,
            config: {
              ...deckGLCategoricalColorSchemeTypeSelect.config,
              choices: [
                [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
                [
                  COLOR_SCHEME_TYPES.categorical_palette,
                  t('Categorical palette'),
                ],
                [COLOR_SCHEME_TYPES.color_breakpoints, t('Color breakpoints')],
              ],
              default: COLOR_SCHEME_TYPES.fixed_color,
            },
          },
        ],
        [
          {
            ...fillColorPicker,
            config: {
              ...fillColorPicker.config,
              description: t('Colour used to fill every feature.'),
            },
          },
        ],
        [
          {
            name: 'color_property',
            config: {
              type: TilePropertyControl,
              multi: false,
              label: t('Colour by'),
              description: t(
                "Tile property whose values decide each feature's colour.",
              ),
              default: null,
              renderTrigger: true,
              mapStateToProps: tilePropertyControlState,
              visibility: ({ controls }) =>
                isColorSchemeTypeVisible(
                  controls,
                  COLOR_SCHEME_TYPES.categorical_palette,
                ),
              resetOnHide: false,
            },
          },
        ],
        [deckGLCategoricalColorSchemeSelect],
        [
          {
            name: 'breakpoint_property',
            config: {
              type: TilePropertyControl,
              multi: false,
              label: t('Colour by'),
              description: t(
                "Numeric tile property whose value picks each feature's breakpoint.",
              ),
              default: null,
              renderTrigger: true,
              mapStateToProps: numericPropertyControlState,
              visibility: ({ controls }) =>
                isColorSchemeTypeVisible(
                  controls,
                  COLOR_SCHEME_TYPES.color_breakpoints,
                ),
              resetOnHide: false,
            },
          },
        ],
        [deckGLColorBreakpointsSelect],
        [breakpointsDefaultColor],
      ],
    },
    {
      label: t('Tooltip'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'tooltip_properties',
            config: {
              type: TilePropertyControl,
              label: t('Tooltip properties'),
              description: t(
                'Tile properties to list in the tooltip, in this order. To place them yourself, write {{ name }} in the template below.',
              ),
              default: [],
              renderTrigger: true,
              mapStateToProps: tilePropertyControlState,
            },
          },
        ],
        [tooltipTemplate],
      ],
    },
  ],
};

export default config;
