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
import {
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  formatSelectOptions,
  sections,
  emitFilterControl,
  ControlPanelConfig,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        emitFilterControl,
        ['groupby'],
        ['columns'], // TODO: this should be migrated to `series_columns`
        ['series_limit'],
        ['series_limit_metric'],
        [
          {
            name: 'whiskerOptions',
            config: {
              clearable: false,
              type: 'SelectControl',
              freeForm: true,
              label: t('Whisker/outlier options'),
              default: 'Tukey',
              description: t(
                'Determines how whiskers and outliers are calculated.',
              ),
              choices: formatSelectOptions([
                'Tukey',
                'Min/max (no outliers)',
                '2/98 percentiles',
                '9/91 percentiles',
              ]),
            },
          },
        ],
      ],
    },
    sections.titleControls,
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [
          {
            name: 'x_ticks_layout',
            config: {
              type: 'SelectControl',
              label: t('X Tick Layout'),
              choices: formatSelectOptions([
                'auto',
                'flat',
                '45°',
                '90°',
                'staggered',
              ]),
              default: 'auto',
              clearable: false,
              renderTrigger: true,
              description: t('The way the ticks are laid out on the X-axis'),
            },
          },
        ],
        [
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Number format'),
              renderTrigger: true,
              default: 'SMART_NUMBER',
              choices: D3_FORMAT_OPTIONS,
              description: `${t(
                'D3 format syntax: https://github.com/d3/d3-format',
              )} ${t('Only applies when "Label Type" is set to show values.')}`,
            },
          },
        ],
        [
          {
            name: 'date_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              default: 'smart_date',
              description: D3_FORMAT_DOCS,
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Series'),
      description: t('Categories to group by on the x-axis.'),
    },
    columns: {
      label: t('Distribute across'),
      multi: true,
      description: t(
        'Columns to calculate distribution across. Defaults to temporal column if left empty.',
      ),
    },
  },
};
export default config;
