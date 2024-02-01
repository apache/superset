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
import {
  columnChoices,
  ControlPanelConfig,
  formatSelectOptions,
  sharedControls,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

const columnsConfig = sharedControls.entity;

const colorChoices = [
  ['rgb(0, 139, 139)', t('Dark Cyan')],
  ['rgb(128, 0, 128)', t('Purple')],
  ['rgb(255, 215, 0)', t('Gold')],
  ['rgb(69, 69, 69)', t('Dim Gray')],
  ['rgb(220, 20, 60)', t('Crimson')],
  ['rgb(34, 139, 34)', t('Forest Green')],
];

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'all_columns_x',
            config: {
              ...columnsConfig,
              label: t('Longitude'),
              description: t('Column containing longitude data'),
            },
          },
        ],
        [
          {
            name: 'all_columns_y',
            config: {
              ...columnsConfig,
              label: t('Latitude'),
              description: t('Column containing latitude data'),
            },
          },
        ],
        [
          {
            name: 'clustering_radius',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Clustering Radius'),
              default: '60',
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
        ],
        ['row_limit'],
        ['adhoc_filters'],
        ['groupby'],
      ],
    },
    {
      label: t('Points'),
      controlSetRows: [
        [
          {
            name: 'point_radius',
            config: {
              type: 'SelectControl',
              label: t('Point Radius'),
              default: 'Auto',
              description: t(
                'The radius of individual points (ones that are not in a cluster). ' +
                  'Either a numerical column or `Auto`, which scales the point based ' +
                  'on the largest cluster',
              ),
              mapStateToProps: state => {
                const datasourceChoices = columnChoices(state.datasource);
                const choices: [string, string][] = [['Auto', t('Auto')]];
                return {
                  choices: choices.concat(datasourceChoices),
                };
              },
            },
          },
        ],
        [
          {
            name: 'point_radius_unit',
            config: {
              type: 'SelectControl',
              label: t('Point Radius Unit'),
              default: 'Pixels',
              choices: [
                ['Pixels', t('Pixels')],
                ['Miles', t('Miles')],
                ['Kilometers', t('Kilometers')],
              ],
              description: t(
                'The unit of measure for the specified point radius',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Labelling'),
      controlSetRows: [
        [
          {
            name: 'mapbox_label',
            config: {
              type: 'SelectControl',
              multi: true,
              label: t('label'),
              default: [],
              description: t(
                '`count` is COUNT(*) if a group by is used. ' +
                  'Numerical columns will be aggregated with the aggregator. ' +
                  'Non-numerical columns will be used to label points. ' +
                  'Leave empty to get a count of points in each cluster.',
              ),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
        ],
        [
          {
            name: 'pandas_aggfunc',
            config: {
              type: 'SelectControl',
              label: t('Cluster label aggregator'),
              clearable: false,
              choices: [
                ['sum', t('sum')],
                ['mean', t('mean')],
                ['min', t('min')],
                ['max', t('max')],
                ['std', t('std')],
                ['var', t('var')],
              ],
              default: 'sum',
              description: t(
                'Aggregate function applied to the list of points ' +
                  'in each cluster to produce the cluster label.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Visual Tweaks'),
      controlSetRows: [
        [
          {
            name: 'render_while_dragging',
            config: {
              type: 'CheckboxControl',
              label: t('Live render'),
              default: true,
              description: t(
                'Points and clusters will update as the viewport is being changed',
              ),
            },
          },
        ],
        [
          {
            name: 'mapbox_style',
            config: {
              type: 'SelectControl',
              label: t('Map Style'),
              clearable: false,
              renderTrigger: true,
              freeForm: true,
              validators: [validateMapboxStylesUrl],
              choices: [
                ['mapbox://styles/mapbox/streets-v9', t('Streets')],
                ['mapbox://styles/mapbox/dark-v9', t('Dark')],
                ['mapbox://styles/mapbox/light-v9', t('Light')],
                [
                  'mapbox://styles/mapbox/satellite-streets-v9',
                  t('Satellite Streets'),
                ],
                ['mapbox://styles/mapbox/satellite-v9', t('Satellite')],
                ['mapbox://styles/mapbox/outdoors-v9', t('Outdoors')],
              ],
              default: 'mapbox://styles/mapbox/light-v9',
              description: t(
                'Base layer map style. See Mapbox documentation: %s',
                'https://docs.mapbox.com/help/glossary/style-url/',
              ),
            },
          },
        ],
        [
          {
            name: 'global_opacity',
            config: {
              type: 'TextControl',
              label: t('Opacity'),
              default: 1,
              isFloat: true,
              description: t(
                'Opacity of all clusters, points, and labels. Between 0 and 1.',
              ),
            },
          },
        ],
        [
          {
            name: 'mapbox_color',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('RGB Color'),
              default: colorChoices[0][0],
              choices: colorChoices,
              description: t('The color for points and clusters in RGB'),
            },
          },
        ],
      ],
    },
    {
      label: t('Viewport'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'viewport_longitude',
            config: {
              type: 'TextControl',
              label: t('Default longitude'),
              renderTrigger: true,
              default: -122.405293,
              isFloat: true,
              description: t('Longitude of default viewport'),
              places: 8,
              // Viewport longitude changes shouldn't prompt user to re-run query
              dontRefreshOnChange: true,
            },
          },
          {
            name: 'viewport_latitude',
            config: {
              type: 'TextControl',
              label: t('Default latitude'),
              renderTrigger: true,
              default: 37.772123,
              isFloat: true,
              description: t('Latitude of default viewport'),
              places: 8,
              // Viewport latitude changes shouldn't prompt user to re-run query
              dontRefreshOnChange: true,
            },
          },
        ],
        [
          {
            name: 'viewport_zoom',
            config: {
              type: 'TextControl',
              label: t('Zoom'),
              renderTrigger: true,
              isFloat: true,
              default: 11,
              description: t('Zoom level of the map'),
              places: 8,
              // Viewport zoom shouldn't prompt user to re-run query
              dontRefreshOnChange: true,
            },
          },
          null,
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      description: t(
        'One or many controls to group by. If grouping, latitude ' +
          'and longitude columns must be present.',
      ),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;
