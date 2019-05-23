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
import timeGrainSqlaAnimationOverrides from './timeGrainSqlaAnimationOverrides';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['adhoc_filters'],
        ['metric', 'point_radius_fixed'],
        ['row_limit', null],
        ['line_column', 'line_type'],
        ['reverse_long_lat', 'filter_nulls'],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        ['autozoom', null],
      ],
    },
    {
      label: t('Polygon Settings'),
      expanded: true,
      controlSetRows: [
        ['fill_color_picker', 'stroke_color_picker'],
        ['filled', 'stroked'],
        ['extruded', 'multiplier'],
        ['line_width', null],
        ['linear_color_scheme', 'opacity'],
        ['num_buckets', 'break_points'],
        ['table_filter', 'toggle_polygons'],
        ['legend_position', null],
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
  controlOverrides: {
    metric: {
      validators: [],
    },
    line_column: {
      label: t('Polygon Column'),
    },
    line_type: {
      label: t('Polygon Encoding'),
    },
    point_radius_fixed: {
      label: t('Elevation'),
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
};
