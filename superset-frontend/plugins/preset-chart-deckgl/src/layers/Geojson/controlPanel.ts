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
import { t } from '@apache-superset/core/translation';
import {
  legacyValidateInteger,
  validateNumber,
  validateInteger,
} from '@superset-ui/core';
import { formatSelectOptions } from '../../utilities/utils';
import {
  filterNulls,
  fillColorPicker,
  strokeColorPicker,
  filled,
  stroked,
  extruded,
  viewport,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  autozoom,
  lineWidth,
  tooltipContents,
  tooltipTemplate,
  crossFilterColumn,
} from '../../utilities/Shared_DeckGL';
import { dndGeojsonColumn } from '../../utilities/sharedDndControls';
import { BLACK_COLOR } from '../../utilities/controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [dndGeojsonColumn],
        ['row_limit'],
        [filterNulls],
        ['adhoc_filters'],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapProvider],
        [mapboxStyle],
        [maplibreStyle],
        [viewport, autozoom],
      ],
    },
    {
      label: t('GeoJson Settings'),
      controlSetRows: [
        [fillColorPicker, strokeColorPicker],
        [filled, stroked],
        [extruded],
        [
          {
            name: 'enable_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Enable labels'),
              description: t('Enables rendering of labels for GeoJSON points'),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'label_property_name',
            config: {
              type: 'TextControl',
              label: t('Label property name'),
              description: t('The feature property to use for point labels'),
              visibility: ({ form_data }) => !!form_data.enable_labels,
              default: 'name',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Label color'),
              description: t('The color of the point labels'),
              visibility: ({ form_data }) => !!form_data.enable_labels,
              default: BLACK_COLOR,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Label size'),
              description: t('The font size of the point labels'),
              visibility: ({ form_data }) => !!form_data.enable_labels,
              validators: [legacyValidateInteger],
              choices: formatSelectOptions([8, 16, 24, 32, 64, 128]),
              default: 24,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_size_unit',
            config: {
              type: 'SelectControl',
              label: t('Label size unit'),
              description: t('The unit for label size'),
              visibility: ({ form_data }) => !!form_data.enable_labels,
              choices: [
                ['meters', t('Meters')],
                ['pixels', t('Pixels')],
              ],
              default: 'pixels',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'enable_icons',
            config: {
              type: 'CheckboxControl',
              label: t('Enable icons'),
              description: t('Enables rendering of icons for GeoJSON points'),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'icon_url',
            config: {
              type: 'TextControl',
              label: t('Icon URL'),
              description: t(
                'The image URL of the icon to display for GeoJSON points. ' +
                  'Note that the image URL must conform to the content ' +
                  'security policy (CSP) in order to load correctly.',
              ),
              visibility: ({ form_data }) => !!form_data.enable_icons,
              default: '',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'icon_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Icon size'),
              description: t('The size of the point icons'),
              visibility: ({ form_data }) => !!form_data.enable_icons,
              validators: [legacyValidateInteger],
              choices: formatSelectOptions([16, 24, 32, 64, 128]),
              default: 32,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'icon_size_unit',
            config: {
              type: 'SelectControl',
              label: t('Icon size unit'),
              description: t('The unit for icon size'),
              visibility: ({ form_data }) => !!form_data.enable_icons,
              choices: [
                ['meters', t('Meters')],
                ['pixels', t('Pixels')],
              ],
              default: 'pixels',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [lineWidth],
        [
          {
            name: 'line_width_unit',
            config: {
              type: 'SelectControl',
              label: t('Line width unit'),
              default: 'pixels',
              choices: [
                ['meters', t('meters')],
                ['pixels', t('pixels')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'point_radius',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Point Radius'),
              description: t(
                'The radius of point features, in the units specified below. ' +
                  'The final rendered size is this value multiplied by Point Radius Scale.',
              ),
              validators: [validateInteger],
              default: 10,
              choices: formatSelectOptions([1, 5, 10, 20, 50, 100]),
              renderTrigger: true,
            },
          },
          {
            name: 'point_radius_scale',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Point Radius Scale'),
              description: t(
                'A multiplier applied to the point radius. ' +
                  'Use this to uniformly scale all points.',
              ),
              validators: [validateNumber],
              default: 1,
              choices: formatSelectOptions([0.1, 0.5, 1, 2, 5, 10]),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'point_radius_units',
            config: {
              type: 'SelectControl',
              label: t('Point Radius Units'),
              description: t(
                'The unit for point radius. Use "pixels" for consistent ' +
                  'screen-space sizing regardless of zoom level.',
              ),
              default: 'pixels',
              choices: [
                ['pixels', t('Pixels')],
                ['meters', t('Meters')],
                ['common', t('Common (unit per pixel at zoom 0)')],
              ],
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [[crossFilterColumn]],
    },
  ],
};

export default config;
