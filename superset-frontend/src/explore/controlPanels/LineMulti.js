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
import { annotations } from './sections';
import { D3_TIME_FORMAT_OPTIONS } from '../controls';
import * as v from '../validators';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme', 'label_colors'],
        [
          {
            name: 'prefix_metric_with_slice_name',
            config: {
              type: 'CheckboxControl',
              label: t('Prefix metric name with slice name'),
              default: false,
              renderTrigger: true,
            },
          },
          null,
        ],
        ['show_legend', 'show_markers'],
        ['line_interpolation', null],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        ['x_axis_label', 'bottom_margin'],
        ['x_ticks_layout', 'x_axis_format'],
        ['x_axis_showminmax', null],
      ],
    },
    {
      label: t('Y Axis 1'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'line_charts',
            config: {
              type: 'SelectAsyncControl',
              multi: true,
              label: t('Left Axis chart(s)'),
              validators: [v.nonEmpty],
              default: [],
              description: t('Choose one or more charts for left axis'),
              dataEndpoint:
                '/sliceasync/api/read?_flt_0_viz_type=line&_flt_7_viz_type=line_multi',
              placeholder: t('Select charts'),
              onAsyncErrorMessage: t('Error while fetching charts'),
              mutator: data => {
                if (!data || !data.result) {
                  return [];
                }
                return data.result.map(o => ({
                  value: o.id,
                  label: o.slice_name,
                }));
              },
            },
          },
          'y_axis_format',
        ],
      ],
    },
    {
      label: t('Y Axis 2'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'line_charts_2',
            config: {
              type: 'SelectAsyncControl',
              multi: true,
              label: t('Right Axis chart(s)'),
              validators: [],
              default: [],
              description: t('Choose one or more charts for right axis'),
              dataEndpoint:
                '/sliceasync/api/read?_flt_0_viz_type=line&_flt_7_viz_type=line_multi',
              placeholder: t('Select charts'),
              onAsyncErrorMessage: t('Error while fetching charts'),
              mutator: data => {
                if (!data || !data.result) {
                  return [];
                }
                return data.result.map(o => ({
                  value: o.id,
                  label: o.slice_name,
                }));
              },
            },
          },
          'y_axis_2_format',
        ],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['adhoc_filters']],
    },
    annotations,
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Left Axis Format'),
    },
    x_axis_format: {
      choices: D3_TIME_FORMAT_OPTIONS,
      default: 'smart_date',
    },
  },
  sectionOverrides: {
    sqlaTimeSeries: {
      controlSetRows: [['time_range']],
    },
    druidTimeSeries: {
      controlSetRows: [['time_range']],
    },
  },
};
