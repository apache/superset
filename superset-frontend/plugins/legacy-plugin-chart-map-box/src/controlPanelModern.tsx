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
import { t, validateMapboxStylesUrl } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createHorizontalLayout,
  createCollapsibleGroup,
  columnChoices,
  formatSelectOptions,
  sharedControls,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

const colorChoices = [
  ['rgb(0, 139, 139)', t('Dark Cyan')],
  ['rgb(128, 0, 128)', t('Purple')],
  ['rgb(255, 215, 0)', t('Gold')],
  ['rgb(69, 69, 69)', t('Dim Gray')],
  ['rgb(220, 20, 60)', t('Crimson')],
  ['rgb(34, 139, 34)', t('Forest Green')],
];

// JSON Schema - defines the data structure
const schema: JsonSchema = {
  type: 'object',
  properties: {
    // Query Section
    all_columns_x: {
      type: 'string',
      title: t('Longitude'),
      default: '',
    },
    all_columns_y: {
      type: 'string',
      title: t('Latitude'),
      default: '',
    },
    clustering_radius: {
      type: 'string',
      title: t('Clustering Radius'),
      enum: ['0', '20', '40', '60', '80', '100', '200', '500', '1000'],
      default: '60',
    },
    row_limit: {
      type: 'integer',
      title: t('Row limit'),
      minimum: 0,
      default: 10000,
    },
    adhoc_filters: {
      type: 'array',
      title: t('Filters'),
      items: { type: 'object' },
      default: [],
    },
    groupby: {
      type: 'array',
      title: t('Group by'),
      items: { type: 'string' },
      default: [],
    },
    
    // Points Section
    point_radius: {
      type: 'string',
      title: t('Point Radius'),
      default: 'Auto',
    },
    point_radius_unit: {
      type: 'string',
      title: t('Point Radius Unit'),
      enum: ['Pixels', 'Miles', 'Kilometers'],
      default: 'Pixels',
    },
    
    // Labelling Section
    mapbox_label: {
      type: 'array',
      title: t('label'),
      items: { type: 'string' },
      default: [],
    },
    pandas_aggfunc: {
      type: 'string',
      title: t('Cluster label aggregator'),
      enum: ['sum', 'mean', 'min', 'max', 'std', 'var'],
      default: 'sum',
    },
    
    // Visual Tweaks Section
    render_while_dragging: {
      type: 'boolean',
      title: t('Live render'),
      default: true,
    },
    mapbox_style: {
      type: 'string',
      title: t('Map Style'),
      enum: [
        'mapbox://styles/mapbox/streets-v9',
        'mapbox://styles/mapbox/dark-v9',
        'mapbox://styles/mapbox/light-v9',
        'mapbox://styles/mapbox/satellite-streets-v9',
        'mapbox://styles/mapbox/satellite-v9',
        'mapbox://styles/mapbox/outdoors-v9'
      ],
      default: 'mapbox://styles/mapbox/light-v9',
    },
    global_opacity: {
      type: 'number',
      title: t('Opacity'),
      minimum: 0,
      maximum: 1,
      default: 1,
    },
    mapbox_color: {
      type: 'string',
      title: t('RGB Color'),
      enum: colorChoices.map(choice => choice[0]),
      default: colorChoices[0][0],
    },
    
    // Viewport Section
    viewport_longitude: {
      type: 'number',
      title: t('Default longitude'),
      default: -122.405293,
    },
    viewport_latitude: {
      type: 'number',
      title: t('Default latitude'),
      default: 37.772123,
    },
    viewport_zoom: {
      type: 'number',
      title: t('Zoom'),
      default: 11,
    },
  },
  required: ['all_columns_x', 'all_columns_y'],
};

// UI Schema - defines the layout
const uischema: UISchemaElement = createVerticalLayout([
  createCollapsibleGroup(t('Query'), [
    {
      type: 'Control',
      scope: '#/properties/all_columns_x',
      options: {
        controlType: 'SelectControl',
        description: t('Column containing longitude data'),
        mapStateToProps: (state: any) => ({
          choices: columnChoices(state.datasource),
        }),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/all_columns_y',
      options: {
        controlType: 'SelectControl',
        description: t('Column containing latitude data'),
        mapStateToProps: (state: any) => ({
          choices: columnChoices(state.datasource),
        }),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/clustering_radius',
      options: {
        controlType: 'SelectControl',
        freeForm: true,
        choices: formatSelectOptions([
          '0',
          '20',
          '40',
          '60',
          '80',
          '100',
          '200',
          '500',
          '1000',
        ]),
        description: t(
          'The radius (in pixels) the algorithm uses to define a cluster. ' +
            'Choose 0 to turn off clustering, but beware that a large ' +
            'number of points (>1000) will cause lag.',
        ),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/row_limit',
      options: { controlType: 'RowLimitControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/adhoc_filters',
      options: { controlType: 'AdhocFiltersControl' },
    },
    {
      type: 'Control',
      scope: '#/properties/groupby',
      options: { controlType: 'GroupByControl' },
    },
  ], true),
  
  createCollapsibleGroup(t('Points'), [
    {
      type: 'Control',
      scope: '#/properties/point_radius',
      options: {
        controlType: 'SelectControl',
        description: t(
          'The radius of individual points (ones that are not in a cluster). ' +
            'Either a numerical column or `Auto`, which scales the point based ' +
            'on the largest cluster',
        ),
        mapStateToProps: (state: any) => {
          const datasourceChoices = columnChoices(state.datasource);
          const choices: [string, string][] = [['Auto', t('Auto')]];
          return {
            choices: choices.concat(datasourceChoices),
          };
        },
      },
    },
    {
      type: 'Control',
      scope: '#/properties/point_radius_unit',
      options: {
        controlType: 'SelectControl',
        choices: [
          ['Pixels', t('Pixels')],
          ['Miles', t('Miles')],
          ['Kilometers', t('Kilometers')],
        ],
        description: t('The unit of measure for the specified point radius'),
      },
    },
  ]),
  
  createCollapsibleGroup(t('Labelling'), [
    {
      type: 'Control',
      scope: '#/properties/mapbox_label',
      options: {
        controlType: 'SelectControl',
        multi: true,
        description: t(
          '`count` is COUNT(*) if a group by is used. ' +
            'Numerical columns will be aggregated with the aggregator. ' +
            'Non-numerical columns will be used to label points. ' +
            'Leave empty to get a count of points in each cluster.',
        ),
        mapStateToProps: (state: any) => ({
          choices: columnChoices(state.datasource),
        }),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/pandas_aggfunc',
      options: {
        controlType: 'SelectControl',
        clearable: false,
        choices: [
          ['sum', t('sum')],
          ['mean', t('mean')],
          ['min', t('min')],
          ['max', t('max')],
          ['std', t('std')],
          ['var', t('var')],
        ],
        description: t(
          'Aggregate function applied to the list of points ' +
            'in each cluster to produce the cluster label.',
        ),
      },
    },
  ]),
  
  createCollapsibleGroup(t('Visual Tweaks'), [
    {
      type: 'Control',
      scope: '#/properties/render_while_dragging',
      options: {
        controlType: 'CheckboxControl',
        description: t('Points and clusters will update as the viewport is being changed'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/mapbox_style',
      options: {
        controlType: 'SelectControl',
        clearable: false,
        renderTrigger: true,
        freeForm: true,
        validators: [validateMapboxStylesUrl],
        choices: [
          ['mapbox://styles/mapbox/streets-v9', t('Streets')],
          ['mapbox://styles/mapbox/dark-v9', t('Dark')],
          ['mapbox://styles/mapbox/light-v9', t('Light')],
          ['mapbox://styles/mapbox/satellite-streets-v9', t('Satellite Streets')],
          ['mapbox://styles/mapbox/satellite-v9', t('Satellite')],
          ['mapbox://styles/mapbox/outdoors-v9', t('Outdoors')],
        ],
        description: t(
          'Base layer map style. See Mapbox documentation: %s',
          'https://docs.mapbox.com/help/glossary/style-url/',
        ),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/global_opacity',
      options: {
        controlType: 'TextControl',
        isFloat: true,
        description: t('Opacity of all clusters, points, and labels. Between 0 and 1.'),
      },
    },
    {
      type: 'Control',
      scope: '#/properties/mapbox_color',
      options: {
        controlType: 'SelectControl',
        freeForm: true,
        choices: colorChoices,
        description: t('The color for points and clusters in RGB'),
      },
    },
  ]),
  
  createCollapsibleGroup(t('Viewport'), [
    createHorizontalLayout([
      {
        type: 'Control',
        scope: '#/properties/viewport_longitude',
        options: {
          controlType: 'TextControl',
          renderTrigger: true,
          isFloat: true,
          description: t('Longitude of default viewport'),
          places: 8,
          dontRefreshOnChange: true,
        },
      },
      {
        type: 'Control',
        scope: '#/properties/viewport_latitude',
        options: {
          controlType: 'TextControl',
          renderTrigger: true,
          isFloat: true,
          description: t('Latitude of default viewport'),
          places: 8,
          dontRefreshOnChange: true,
        },
      },
    ]),
    {
      type: 'Control',
      scope: '#/properties/viewport_zoom',
      options: {
        controlType: 'TextControl',
        renderTrigger: true,
        isFloat: true,
        description: t('Zoom level of the map'),
        places: 8,
        dontRefreshOnChange: true,
      },
    },
  ], true),
]);

// Control panel configuration
const config: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  controlOverrides: {
    groupby: {
      description: t(
        'One or many controls to group by. If grouping, latitude ' +
          'and longitude columns must be present.',
      ),
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;