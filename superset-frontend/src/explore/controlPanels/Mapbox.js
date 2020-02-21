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

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x', 'all_columns_y'],
        ['clustering_radius'],
        ['row_limit'],
        ['adhoc_filters'],
        ['groupby'],
      ],
    },
    {
      label: t('Points'),
      controlSetRows: [['point_radius'], ['point_radius_unit']],
    },
    {
      label: t('Labelling'),
      controlSetRows: [['mapbox_label'], ['pandas_aggfunc']],
    },
    {
      label: t('Visual Tweaks'),
      controlSetRows: [
        ['render_while_dragging'],
        ['mapbox_style'],
        ['global_opacity'],
        ['mapbox_color'],
      ],
    },
    {
      label: t('Viewport'),
      expanded: true,
      controlSetRows: [
        ['viewport_longitude', 'viewport_latitude'],
        ['viewport_zoom', null],
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
    rich_tooltip: {
      label: t('Tooltip'),
      description: t(
        'Show a tooltip when hovering over points and clusters ' +
          'describing the label',
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
