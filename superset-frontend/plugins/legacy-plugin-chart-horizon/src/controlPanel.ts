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
  ControlPanelConfig,
  formatSelectOptions,
  AdhocFiltersControl,
  GranularitySqlaControl,
  GroupByControl,
  LimitControl,
  MetricsControl,
  OrderDescControl,
  RowLimitControl,
  TimeLimitMetricControl,
  TimeRangeControl,
  InlineCheckboxControl as CheckboxControl,
  InlineSelectControl as SelectControl,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Time'),
      expanded: true,
      description: t('Time related form attributes'),
      controlSetRows: [[GranularitySqlaControl()], [TimeRangeControl()]],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [MetricsControl()],
        [AdhocFiltersControl()],
        [GroupByControl()],
        [LimitControl(), TimeLimitMetricControl()],
        [OrderDescControl()],
        [
          CheckboxControl({
            name: 'contribution',
            label: t('Contribution'),
            default: false,
            description: t('Compute the contribution to the total'),
          }),
        ],
        [RowLimitControl(), null],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          SelectControl({
            name: 'series_height',
            renderTrigger: true,
            freeForm: true,
            label: t('Series Height'),
            default: '25',
            choices: formatSelectOptions([
              '10',
              '25',
              '40',
              '50',
              '75',
              '100',
              '150',
              '200',
            ]),
            description: t('Pixel height of each series'),
          }),
          SelectControl({
            name: 'horizon_color_scale',
            renderTrigger: true,
            label: t('Value Domain'),
            choices: [
              ['series', t('series')],
              ['overall', t('overall')],
              ['change', t('change')],
            ],
            default: 'series',
            description: t(
              'series: Treat each series independently; overall: All series use the same scale; change: Show changes compared to the first data point in each series',
            ),
          }),
        ],
      ],
    },
  ],
};

export default config;
