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

// These are control configurations that are shared ONLY within the DeckGL viz plugin repo.

import {
  FeatureFlag,
  isFeatureEnabled,
  t,
  validateNonEmpty,
  validateMapboxStylesUrl,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
} from '@superset-ui/core';
import {
  ControlPanelState,
  CustomControlItem,
  D3_FORMAT_OPTIONS,
  getColorControlsProps,
  sharedControls,
} from '@superset-ui/chart-controls';
import { columnChoices, PRIMARY_COLOR } from './controls';
import {
  COLOR_SCHEME_TYPES,
  ColorSchemeType,
  isColorSchemeTypeVisible,
} from './utils';

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

export const DEFAULT_DECKGL_COLOR = { r: 158, g: 158, b: 158, a: 1 };

let deckglTiles: string[][];

export const DEFAULT_DECKGL_TILES = [
  ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'Streets (OSM)'],
  ['https://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png', 'Topography (OSM)'],
  ['mapbox://styles/mapbox/streets-v9', 'Streets (Mapbox)'],
  ['mapbox://styles/mapbox/dark-v9', 'Dark (Mapbox)'],
  ['mapbox://styles/mapbox/light-v9', 'Light (Mapbox)'],
  ['mapbox://styles/mapbox/satellite-streets-v9', 'Satellite Streets (Mapbox)'],
  ['mapbox://styles/mapbox/satellite-v9', 'Satellite (Mapbox)'],
  ['mapbox://styles/mapbox/outdoors-v9', 'Outdoors (Mapbox)'],
];

const getDeckGLTiles = () => {
  if (!deckglTiles) {
    const appContainer = document.getElementById('app');
    const { common } = JSON.parse(
      appContainer?.getAttribute('data-bootstrap') || '{}',
    );
    deckglTiles = common?.deckgl_tiles ?? DEFAULT_DECKGL_TILES;
  }
  return deckglTiles;
};

const DEFAULT_VIEWPORT = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const sandboxUrl =
  'https://github.com/apache/superset/' +
  'blob/master/superset-frontend/plugins/legacy-preset-chart-deckgl/src/utils/sandbox.ts';
const jsFunctionInfo = (
  <div>
    {t(
      'For more information about objects are in context in the scope of this function, refer to the',
    )}
    <a href={sandboxUrl}>{t(" source code of Superset's sandboxed parser")}.</a>
    .
  </div>
);

function jsFunctionControl(
  label: string,
  description: string,
  extraDescr = null,
  height = 100,
  defaultText = '',
) {
  return {
    type: 'TextAreaControl',
    language: 'javascript',
    label,
    description,
    height,
    default: defaultText,
    aboveEditorSection: (
      <div>
        <p>{description}</p>
        <p>{jsFunctionInfo}</p>
        {extraDescr}
      </div>
    ),
    warning: !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)
      ? t(
          'This functionality is disabled in your environment for security reasons.',
        )
      : null,
    readOnly: !isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
  };
}

export const filterNulls = {
  name: 'filter_nulls',
  config: {
    type: 'CheckboxControl',
    label: t('Ignore null locations'),
    default: true,
    description: t('Whether to ignore locations that are null'),
  },
};

export const autozoom = {
  name: 'autozoom',
  config: {
    type: 'CheckboxControl',
    label: t('Auto Zoom'),
    default: true,
    renderTrigger: true,
    description: t(
      'When checked, the map will zoom to your data after each query',
    ),
  },
};

export const dimension: CustomControlItem = {
  name: 'dimension',
  config: {
    ...sharedControls.groupby,
    label: t('Dimension'),
    description: t('Select a dimension'),
    multi: false,
    default: null,
  },
};

export const jsColumns = {
  name: 'js_columns',
  config: {
    ...sharedControls.groupby,
    label: t('Extra data for JS'),
    default: [],
    description: t(
      'List of extra columns made available in JavaScript functions',
    ),
  },
};

export const jsDataMutator = {
  name: 'js_data_mutator',
  config: jsFunctionControl(
    t('JavaScript data interceptor'),
    t(
      'Define a javascript function that receives the data array used in the visualization ' +
        'and is expected to return a modified version of that array. This can be used ' +
        'to alter properties of the data, filter, or enrich the array.',
    ),
  ),
};

export const jsTooltip = {
  name: 'js_tooltip',
  config: jsFunctionControl(
    t('JavaScript tooltip generator'),
    t(
      'Define a function that receives the input and outputs the content for a tooltip',
    ),
  ),
};

export const jsOnclickHref = {
  name: 'js_onclick_href',
  config: jsFunctionControl(
    t('JavaScript onClick href'),
    t('Define a function that returns a URL to navigate to when user clicks'),
  ),
};

export const legendFormat = {
  name: 'legend_format',
  config: {
    label: t('Legend Format'),
    description: t('Choose the format for legend values'),
    type: 'SelectControl',
    clearable: false,
    default: D3_FORMAT_OPTIONS[0][0],
    choices: D3_FORMAT_OPTIONS,
    renderTrigger: true,
    freeForm: true,
  },
};

export const legendPosition = {
  name: 'legend_position',
  config: {
    label: t('Legend Position'),
    description: t('Choose the position of the legend'),
    type: 'SelectControl',
    clearable: false,
    default: 'tr',
    choices: [
      [null, t('None')],
      ['tl', t('Top left')],
      ['tr', t('Top right')],
      ['bl', t('Bottom left')],
      ['br', t('Bottom right')],
    ],
    renderTrigger: true,
  },
};

export const lineColumn = {
  name: 'line_column',
  config: {
    type: 'SelectControl',
    label: t('Lines column'),
    default: null,
    description: t('The database columns that contains lines information'),
    mapStateToProps: (state: ControlPanelState) => ({
      choices: columnChoices(state.datasource),
    }),
    validators: [validateNonEmpty],
  },
};

export const lineWidth = {
  name: 'line_width',
  config: {
    type: 'TextControl',
    label: t('Line width'),
    renderTrigger: true,
    isInt: true,
    default: 1,
    description: t('The width of the lines'),
  },
};

export const fillColorPicker: CustomControlItem = {
  name: 'fill_color_picker',
  config: {
    label: t('Fill Color'),
    description: t(
      ' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON',
    ),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.fixed_color),
  },
};

export const strokeColorPicker: CustomControlItem = {
  name: 'stroke_color_picker',
  config: {
    label: t('Stroke Color'),
    description: t(
      ' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON',
    ),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.fixed_color),
  },
};

export const filled = {
  name: 'filled',
  config: {
    type: 'CheckboxControl',
    label: t('Filled'),
    renderTrigger: true,
    description: t('Whether to fill the objects'),
    default: true,
  },
};

export const stroked = {
  name: 'stroked',
  config: {
    type: 'CheckboxControl',
    label: t('Stroked'),
    renderTrigger: true,
    description: t('Whether to display the stroke'),
    default: false,
  },
};

export const extruded = {
  name: 'extruded',
  config: {
    type: 'CheckboxControl',
    label: t('Extruded'),
    renderTrigger: true,
    default: true,
    description: t('Whether to make the grid 3D'),
  },
};

export const gridSize = {
  name: 'grid_size',
  config: {
    type: 'TextControl',
    label: t('Grid Size'),
    renderTrigger: true,
    default: 20,
    isInt: true,
    description: t('Defines the grid size in pixels'),
  },
};

export const viewport = {
  name: 'viewport',
  config: {
    type: 'ViewportControl',
    label: t('Viewport'),
    renderTrigger: false,
    description: t('Parameters related to the view and perspective on the map'),
    // default is whole world mostly centered
    default: DEFAULT_VIEWPORT,
    // Viewport changes shouldn't prompt user to re-run query
    dontRefreshOnChange: true,
  },
};

export const spatial = {
  name: 'spatial',
  config: {
    type: 'SpatialControl',
    label: t('Longitude & Latitude'),
    validators: [validateNonEmpty],
    description: t('Point to your spatial columns'),
    mapStateToProps: (state: ControlPanelState) => ({
      choices: columnChoices(state.datasource),
    }),
  },
};

export const pointRadiusFixed = {
  name: 'point_radius_fixed',
  config: {
    type: 'FixedOrMetricControl',
    label: t('Point Size'),
    default: { type: 'fix', value: 1000 },
    description: t('Fixed point radius'),
    mapStateToProps: (state: ControlPanelState) => ({
      datasource: state.datasource,
    }),
  },
};

export const multiplier = {
  name: 'multiplier',
  config: {
    type: 'TextControl',
    label: t('Multiplier'),
    isFloat: true,
    renderTrigger: true,
    default: 1,
    description: t('Factor to multiply the metric by'),
  },
};

export const lineType = {
  name: 'line_type',
  config: {
    type: 'SelectControl',
    label: t('Lines encoding'),
    clearable: false,
    default: 'json',
    description: t('The encoding format of the lines'),
    choices: [
      ['polyline', t('Polyline')],
      ['json', t('JSON')],
      ['geohash', t('geohash (square)')],
    ],
  },
};

export const reverseLongLat = {
  name: 'reverse_long_lat',
  config: {
    type: 'CheckboxControl',
    label: t('Reverse Lat & Long'),
    default: false,
  },
};

export const mapboxStyle = {
  name: 'mapbox_style',
  config: {
    type: 'SelectControl',
    label: t('Map Style'),
    clearable: false,
    renderTrigger: true,
    freeForm: true,
    validators: [validateMapboxStylesUrl],
    choices: getDeckGLTiles(),
    default: getDeckGLTiles()[0][0],
    description: t(
      'Base layer map style. See Mapbox documentation: %s',
      'Mapbox base layer map style (see Mapbox documentation: %s) or tile server URL.',
      'https://docs.mapbox.com/help/glossary/style-url/',
    ),
  },
};

export const geojsonColumn = {
  name: 'geojson',
  config: {
    type: 'SelectControl',
    label: t('GeoJson Column'),
    validators: [validateNonEmpty],
    description: t('Select the geojson column'),
    mapStateToProps: (state: ControlPanelState) => ({
      choices: columnChoices(state.datasource),
    }),
  },
};

export const deckGLCategoricalColorSchemeTypeSelect: CustomControlItem = {
  name: 'color_scheme_type',
  config: {
    type: 'SelectControl',
    label: t('Color Scheme Type'),
    description: t('Select the type of color scheme to use.'),
    clearable: false,
    renderTrigger: true,
    validators: [],
    choices: [
      [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
      [COLOR_SCHEME_TYPES.categorical_palette, t('Categorical palette')],
      [COLOR_SCHEME_TYPES.color_breakpoints, t('Color breakpoints')],
    ],
    default: COLOR_SCHEME_TYPES.categorical_palette,
  },
};

export const deckGLFixedColor: CustomControlItem = {
  name: 'color_picker',
  config: {
    type: 'ColorPickerControl',
    label: t('Fixed Color'),
    default: PRIMARY_COLOR,
    renderTrigger: true,
    description: t('Select the fixed color'),
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.fixed_color),
  },
};

export const deckGLCategoricalColor: CustomControlItem = {
  name: dimension.name,
  config: {
    ...dimension.config,
    label: t('Categorical Color'),
    description: t(
      'Pick a dimension from which categorical colors are defined',
    ),
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(
        controls,
        COLOR_SCHEME_TYPES.categorical_palette,
      ),
  },
};

export const deckGLCategoricalColorSchemeSelect: CustomControlItem = {
  name: 'color_scheme',
  config: {
    type: 'ColorSchemeControl',
    label: t('Color Scheme'),
    default: categoricalSchemeRegistry.getDefaultKey(),
    renderTrigger: true,
    choices: () => categoricalSchemeRegistry.keys().map(s => [s, s]),
    description: t('The color scheme for rendering chart'),
    schemes: () => categoricalSchemeRegistry.getMap(),
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(
        controls,
        COLOR_SCHEME_TYPES.categorical_palette,
      ),
  },
};

export const deckGLLinearColorSchemeSelect: CustomControlItem = {
  name: 'linear_color_scheme',
  config: {
    type: 'ColorSchemeControl',
    label: t('Linear Color Scheme'),
    choices: () =>
      (sequentialSchemeRegistry.values() as SequentialScheme[]).map(value => [
        value.id,
        value.label,
      ]),
    default: sequentialSchemeRegistry.getDefaultKey(),
    clearable: false,
    description: t('Select a linear color scheme'),
    renderTrigger: true,
    schemes: () => sequentialSchemeRegistry.getMap(),
    isLinear: true,
    mapStateToProps: state => getColorControlsProps(state),
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.linear_palette),
  },
};

export const deckGLColorBreakpointsSelect: CustomControlItem = {
  name: 'color_breakpoints',
  config: {
    label: t('Color breakpoints'),
    type: 'ColorBreakpointsControl',
    description: t('Define color breakpoints for the data'),
    renderTrigger: true,
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.color_breakpoints),
  },
};

export const breakpointsDefaultColor: CustomControlItem = {
  name: 'deafult_breakpoint_color',
  config: {
    label: t('Default color'),
    type: 'ColorPickerControl',
    description: t(
      "The color used when a value doesn't match any defined breakpoints.",
    ),
    default: DEFAULT_DECKGL_COLOR,
    renderTrigger: true,
    visibility: ({ controls }) =>
      isColorSchemeTypeVisible(controls, COLOR_SCHEME_TYPES.color_breakpoints),
  },
};

export const deckGLCategoricalColorSchemeControls = [
  [deckGLCategoricalColorSchemeTypeSelect],
  [deckGLFixedColor],
  [deckGLCategoricalColor],
  [deckGLCategoricalColorSchemeSelect],
  [deckGLColorBreakpointsSelect],
];

export const generateDeckGLColorSchemeControls = ({
  defaultSchemeType,
  disableCategoricalColumn = false,
}: {
  defaultSchemeType?: ColorSchemeType;
  disableCategoricalColumn?: boolean;
}) => [
  [
    {
      name: 'color_scheme_type',
      config: {
        type: 'SelectControl',
        label: t('Color Scheme Type'),
        description: t('Select the type of color scheme to use.'),
        clearable: false,
        renderTrigger: true,
        validators: [],
        choices: [
          [COLOR_SCHEME_TYPES.fixed_color, t('Fixed color')],
          [COLOR_SCHEME_TYPES.categorical_palette, t('Categorical palette')],
          [COLOR_SCHEME_TYPES.color_breakpoints, t('Color breakpoints')],
        ],
        default: defaultSchemeType || COLOR_SCHEME_TYPES.categorical_palette,
      },
    },
  ],
  [deckGLFixedColor],
  disableCategoricalColumn ? [] : [deckGLCategoricalColor],
  [deckGLCategoricalColorSchemeSelect],
  [breakpointsDefaultColor],
  [deckGLColorBreakpointsSelect],
];
