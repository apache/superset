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
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['domain_granularity', 'subdomain_granularity'],
        ['metrics'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['linear_color_scheme'],
        ['cell_size', 'cell_padding'],
        ['cell_radius', 'steps'],
        ['y_axis_format', 'x_axis_time_format'],
        ['show_legend', 'show_values'],
        ['show_metric_name', null],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number Format'),
    },
    x_axis_time_format: {
      label: t('Time Format'),
    },
    show_values: {
      default: false,
    },
  },
};
