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
import { t } from '@superset-ui/translation';
import { formatSelectOptions } from '../../modules/utils';
import { columnChoices } from '../controls';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x', 'all_columns_y'],
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
              mapStateToProps: state => ({
                choices: formatSelectOptions(['Auto']).concat(
                  columnChoices(state.datasource),
                ),
              }),
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
              choices: formatSelectOptions(['Pixels', 'Miles', 'Kilometers']),
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
      controlSetRows: [['mapbox_label'], ['pandas_aggfunc']],
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
        ['mapbox_style'],
        ['global_opacity'],
        [
          {
            name: 'mapbox_color',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('RGB Color'),
              default: 'rgb(0, 122, 135)',
              choices: [
                ['rgb(0, 139, 139)', 'Dark Cyan'],
                ['rgb(128, 0, 128)', 'Purple'],
                ['rgb(255, 215, 0)', 'Gold'],
                ['rgb(69, 69, 69)', 'Dim Gray'],
                ['rgb(220, 20, 60)', 'Crimson'],
                ['rgb(34, 139, 34)', 'Forest Green'],
              ],
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
    all_columns_x: {
      label: t('Longitude'),
      description: t('Column containing longitude data'),
    },
    all_columns_y: {
      label: t('Latitude'),
      description: t('Column containing latitude data'),
    },
    pandas_aggfunc: {
      label: t('Cluster label aggregator'),
      description: t(
        'Aggregate function applied to the list of points ' +
          'in each cluster to produce the cluster label.',
      ),
    },
    groupby: {
      description: t(
        'One or many controls to group by. If grouping, latitude ' +
          'and longitude columns must be present.',
      ),
    },
  },
};
