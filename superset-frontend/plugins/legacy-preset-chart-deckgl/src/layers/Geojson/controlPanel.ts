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
import { t } from '@apache-superset/core';
import {
  legacyValidateInteger,
  isFeatureEnabled,
  FeatureFlag,
  validateNumber,
  validateInteger,
} from '@superset-ui/core';
import { formatSelectOptions } from '../../utilities/utils';
import {
  filterNulls,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  fillColorPicker,
  strokeColorPicker,
  filled,
  stroked,
  extruded,
  viewport,
  mapboxStyle,
  autozoom,
  lineWidth,
  tooltipContents,
  tooltipTemplate,
  jsFunctionControl,
} from '../../utilities/Shared_DeckGL';
import { dndGeojsonColumn } from '../../utilities/sharedDndControls';
import { BLACK_COLOR } from '../../utilities/controls';

const defaultLabelConfigGenerator = `() => ({
  // Check the documentation at:
  // https://deck.gl/docs/api-reference/layers/geojson-layer#pointtype-options-2
  getText: f => f.properties.name,
  getTextColor: [0, 0, 0, 255],
  getTextSize: 24,
  textSizeUnits: 'pixels',
})`;

const defaultIconConfigGenerator = `() => ({
  // Check the documentation at:
  // https://deck.gl/docs/api-reference/layers/geojson-layer#pointtype-options-1
  getIcon: () => ({ url: '', height: 128, width: 128 }),
  getIconSize: 32,
  iconSizeUnits: 'pixels',
})`;

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
      controlSetRows: [[mapboxStyle, viewport], [autozoom]],
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
            name: 'enable_label_javascript_mode',
            config: {
              type: 'CheckboxControl',
              label: t('Enable label JavaScript mode'),
              description: t(
                'Enables custom label configuration via JavaScript',
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
              default: false,
              renderTrigger: true,
              resetOnHide: false,
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
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
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
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
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
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
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
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
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
            name: 'label_javascript_config_generator',
            config: {
              ...jsFunctionControl(
                t('Label JavaScript config generator'),
                t(
                  'A JavaScript function that generates a label configuration object',
                ),
                undefined,
                undefined,
                defaultLabelConfigGenerator,
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                !!form_data.enable_label_javascript_mode &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
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
            name: 'enable_icon_javascript_mode',
            config: {
              type: 'CheckboxControl',
              label: t('Enable icon JavaScript mode'),
              description: t(
                'Enables custom icon configuration via JavaScript',
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
              default: false,
              renderTrigger: true,
              resetOnHide: false,
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
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                (!form_data.enable_icon_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
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
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                (!form_data.enable_icon_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
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
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                (!form_data.enable_icon_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
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
            name: 'icon_javascript_config_generator',
            config: {
              ...jsFunctionControl(
                t('Icon JavaScript config generator'),
                t(
                  'A JavaScript function that generates an icon configuration object',
                ),
                undefined,
                undefined,
                defaultIconConfigGenerator,
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                !!form_data.enable_icon_javascript_mode &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
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
      controlSetRows: [
        [jsColumns],
        [jsDataMutator],
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
};

export default config;
