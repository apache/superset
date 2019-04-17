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
import { NVD3TimeSeries, annotations } from './sections';
import { D3_TIME_FORMAT_OPTIONS } from '../controls';

export default {
  requiresTime: true,
  controlPanelSections: [
    NVD3TimeSeries[0],
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['show_brush', 'show_legend'],
        ['line_interpolation', 'stacked_style'],
        ['color_scheme', 'label_colors'],
        ['rich_tooltip', 'show_controls'],
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
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        ['y_axis_format', 'y_axis_bounds'],
        ['y_log_scale', null],
      ],
    },
    NVD3TimeSeries[1],
    annotations,
  ],
  controlOverrides: {
    x_axis_format: {
      default: 'smart_date',
      choices: D3_TIME_FORMAT_OPTIONS,
    },
    color_scheme: {
      renderTrigger: false,
    },
  },
};
