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
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { validateInteger } from '@superset-ui/core';
import {
  fillColorPicker,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  tooltipTemplate,
  viewport,
} from '../../utilities/Shared_DeckGL';

import { columnChoices } from '../../utilities/controls';

import {
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  isTileUrlTemplate,
} from './layerSettings';

/** Returns an error message unless the value is a URL template with {z}, {x} and {y}. */
export const validateTileUrl = (value: unknown): string | false =>
  isTileUrlTemplate(value) ? false : t('must contain {z}, {x} and {y}');

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
            name: 'source_layer',
            config: {
              type: 'TextControl',
              label: t('Source layer'),
              description: t(
                'Name of the layer inside each tile to draw. Leave empty to draw every layer.',
              ),
              default: '',
              renderTrigger: true,
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
            ...fillColorPicker,
            config: {
              ...fillColorPicker.config,
              description: t('Colour used to fill every feature.'),
            },
          },
        ],
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
              type: 'SelectControl',
              multi: true,
              freeForm: true,
              clearable: true,
              label: t('Tooltip properties'),
              description: t(
                'Tile properties to list in the tooltip, in this order. To place them yourself, write {{ name }} in the template below.',
              ),
              default: [],
              renderTrigger: true,
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
        ],
        [tooltipTemplate],
      ],
    },
  ],
};

export default config;
