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

import React from 'react';
import { t } from '@superset-ui/translation';
import { validateNonEmpty } from '@superset-ui/validator';
import { sharedControls } from '@superset-ui/chart-controls';
import { D3_FORMAT_OPTIONS, columnChoices, PRIMARY_COLOR } from '../controls';
import { DEFAULT_VIEWPORT } from '../../explore/components/controls/ViewportControl';

const sandboxUrl =
  'https://github.com/apache/incubator-superset/' +
  'blob/master/superset-frontend/src/modules/sandbox.js';
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
  label,
  description,
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
    mapStateToProps: state => ({
      warning: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS
        ? t(
            'This functionality is disabled in your environment for security reasons.',
          )
        : null,
      readOnly: !state.common.conf.ENABLE_JAVASCRIPT_CONTROLS,
    }),
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

export const dimension = {
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
      'List of extra columns made available in Javascript functions',
    ),
  },
};

export const jsDataMutator = {
  name: 'js_data_mutator',
  config: jsFunctionControl(
    t('Javascript data interceptor'),
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
    t('Javascript tooltip generator'),
    t(
      'Define a function that receives the input and outputs the content for a tooltip',
    ),
  ),
};

export const jsOnclickHref = {
  name: 'js_onclick_href',
  config: jsFunctionControl(
    t('Javascript onClick href'),
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
    default: D3_FORMAT_OPTIONS[0],
    choices: D3_FORMAT_OPTIONS,
    renderTrigger: true,
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
      [null, 'None'],
      ['tl', 'Top left'],
      ['tr', 'Top right'],
      ['bl', 'Bottom left'],
      ['br', 'Bottom right'],
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
    mapStateToProps: state => ({
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
    default: 10,
    description: t('The width of the lines'),
  },
};

export const fillColorPicker = {
  name: 'fill_color_picker',
  config: {
    label: t('Fill Color'),
    description: t(
      ' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON',
    ),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
  },
};

export const strokeColorPicker = {
  name: 'stroke_color_picker',
  config: {
    label: t('Stroke Color'),
    description: t(
      ' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON',
    ),
    type: 'ColorPickerControl',
    default: PRIMARY_COLOR,
    renderTrigger: true,
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
    description: 'Whether to make the grid 3D',
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
    mapStateToProps: state => ({
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
    mapStateToProps: state => ({
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
      ['polyline', 'Polyline'],
      ['json', 'JSON'],
      ['geohash', 'geohash (square)'],
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
    choices: [
      ['mapbox://styles/mapbox/streets-v9', 'Streets'],
      ['mapbox://styles/mapbox/dark-v9', 'Dark'],
      ['mapbox://styles/mapbox/light-v9', 'Light'],
      ['mapbox://styles/mapbox/satellite-streets-v9', 'Satellite Streets'],
      ['mapbox://styles/mapbox/satellite-v9', 'Satellite'],
      ['mapbox://styles/mapbox/outdoors-v9', 'Outdoors'],
    ],
    default: 'mapbox://styles/mapbox/light-v9',
    description: t('Base layer map style'),
  },
};
