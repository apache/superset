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
import { t } from '@superset-ui/core';
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['series'],
        ['metrics'],
        ['secondary_metric'],
        ['adhoc_filters'],
        ['limit', 'row_limit'],
        ['timeseries_limit_metric'],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
              visibility: ({ controls }) =>
                Boolean(controls?.timeseries_limit_metric.value),
            },
          },
        ],
      ],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_datatable',
            config: {
              type: 'CheckboxControl',
              label: t('Data Table'),
              default: false,
              renderTrigger: true,
              description: t('Whether to display the interactive data table'),
            },
          },
          {
            name: 'include_series',
            config: {
              type: 'CheckboxControl',
              label: t('Include Series'),
              renderTrigger: true,
              default: false,
              description: t('Include series name as an axis'),
            },
          },
        ],
        ['linear_color_scheme'],
      ],
    },
  ],
};

export default config;
