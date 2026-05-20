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
import {
  columnChoices,
  ControlPanelConfig,
  formatSelectOptions,
  sharedControls,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

const columnsConfig = sharedControls.entity;

const colorChoices = [
  ['#008b8b', t('Dark Cyan')],
  ['#800080', t('Purple')],
  ['#ffd700', t('Gold')],
  ['#454545', t('Dim Gray')],
  ['#dc143c', t('Crimson')],
  ['#228b22', t('Forest Green')],
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
              mapStateToProps: (state: any) => {
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
            name: 'map_label',
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
              mapStateToProps: (state: any) => ({
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
      label: t('Map'),
      tabOverride: 'customize',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'map_renderer',
            config: {
              type: 'SelectControl',
              label: t('Map Renderer'),
              clearable: false,
              renderTrigger: true,
              choices: [
                ['maplibre', t('MapLibre (open-source)')],
                ['mapbox', t('Mapbox (API key required)')],
              ],
              default: 'maplibre',
              description: t(
                'MapLibre is open-source and requires no API key. Mapbox requires MAPBOX_API_KEY to be configured on the server.',
              ),
            },
          },
        ],
        [
          {
            name: 'maplibre_style',
            config: {
              type: 'SelectControl',
              label: t('Map Style'),
              clearable: false,
              renderTrigger: true,
              freeForm: true,
              choices: [
                [
                  'https://tiles.openfreemap.org/styles/liberty',
                  t('Liberty (OpenFreeMap)'),
                ],
                [
                  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                  t('Light (Carto)'),
                ],
                [
                  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
                  t('Dark (Carto)'),
                ],
                [
                  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
                  t('Streets (Carto)'),
                ],
              ],
              default: 'https://tiles.openfreemap.org/styles/liberty',
              description: t(
                'Base layer map style. See MapLibre documentation: %s',
                'https://maplibre.org/maplibre-style-spec/',
              ),
              visibility: ({ controls }: any) =>
                controls?.map_renderer?.value !== 'mapbox',
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
              choices: [
                ['mapbox://styles/mapbox/streets-v12', t('Streets')],
                ['mapbox://styles/mapbox/outdoors-v12', t('Outdoors')],
                ['mapbox://styles/mapbox/light-v11', t('Light')],
                ['mapbox://styles/mapbox/dark-v11', t('Dark')],
                ['mapbox://styles/mapbox/satellite-v9', t('Satellite')],
                [
                  'mapbox://styles/mapbox/satellite-streets-v12',
                  t('Satellite Streets'),
                ],
              ],
              default: 'mapbox://styles/mapbox/light-v11',
              description: t(
                'Base layer map style. Accepts a Mapbox style URL (mapbox://styles/...).',
              ),
              visibility: ({ controls }: any) =>
                controls?.map_renderer?.value === 'mapbox',
            },
          },
        ],
      ],
    },
    {
      label: t('Visual Tweaks'),
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'render_while_dragging',
            config: {
              type: 'CheckboxControl',
              label: t('Live render'),
              renderTrigger: true,
              default: true,
              description: t(
                'Points and clusters will update as the viewport is being changed',
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
              renderTrigger: true,
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
            name: 'map_color',
            config: {
              type: 'SelectControl',
              freeForm: true,
              renderTrigger: true,
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
              default: '',
              isFloat: true,
              description: t('Longitude of default viewport'),
              places: 8,
              dontRefreshOnChange: true,
            },
          },
          {
            name: 'viewport_latitude',
            config: {
              type: 'TextControl',
              label: t('Default latitude'),
              renderTrigger: true,
              default: '',
              isFloat: true,
              description: t('Latitude of default viewport'),
              places: 8,
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
              default: '',
              description: t('Zoom level of the map'),
              places: 8,
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
  formDataOverrides: (formData: any) => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;
