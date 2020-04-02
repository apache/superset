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
import { nonEmpty, integer } from '../validators';
import { formatSelectOptions } from '../../modules/utils';
import { columnChoices } from '../controls';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'geojson',
            config: {
              type: 'SelectControl',
              label: t('GeoJson Column'),
              validators: [nonEmpty],
              description: t('Select the geojson column'),
              mapStateToProps: state => ({
                choices: columnChoices(state.datasource),
              }),
            },
          },
          null,
        ],
        ['row_limit', 'filter_nulls'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        // TODO ['autozoom', null],
      ],
    },
    {
      label: t('GeoJson Settings'),
      controlSetRows: [
        ['fill_color_picker', 'stroke_color_picker'],
        ['filled', 'stroked'],
        ['extruded', null],
        [
          {
            name: 'point_radius_scale',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Point Radius Scale'),
              validators: [integer],
              default: null,
              choices: formatSelectOptions([0, 100, 200, 300, 500]),
            },
          },
          null,
        ],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        ['js_columns'],
        ['js_data_mutator'],
        ['js_tooltip'],
        ['js_onclick_href'],
      ],
    },
  ],
};
