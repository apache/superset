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
import { t } from '@apache-superset/core/translation';
import {
  ControlPanelConfig,
  D3_TIME_FORMAT_OPTIONS,
  sections,
} from '@superset-ui/chart-controls';

// Control names match the legacy nvd3 chart so saved charts keep working
// without a form-data migration. nvd3-specific pixel-margin and min/max
// toggles are intentionally dropped; ECharts lays those out automatically.
const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
        [
          {
            name: 'freq',
            config: {
              type: 'SelectControl',
              label: t('Frequency'),
              default: 'W-MON',
              freeForm: true,
              clearable: false,
              choices: [
                ['AS', t('Year (freq=AS)')],
                ['52W-MON', t('52 weeks starting Monday (freq=52W-MON)')],
                ['W-SUN', t('1 week starting Sunday (freq=W-SUN)')],
                ['W-MON', t('1 week starting Monday (freq=W-MON)')],
                ['D', t('Day (freq=D)')],
                ['4W-MON', t('4 weeks (freq=4W-MON)')],
              ],
              description: t(
                `The periodicity over which to pivot time. Each period becomes
                its own overlaid series, so pick a Time Grain finer than this
                frequency to see lines (e.g. Day grain with a weekly
                frequency); with one data point per period each series renders
                as a single dot. Users can provide "Pandas" offset aliases.
                Click on the info bubble for more details on accepted "freq"
                expressions.`,
              ),
              tooltipOnClick: () => {
                window.open(
                  'https://pandas.pydata.org/pandas-docs/stable/user_guide/timeseries.html#offset-aliases',
                  '_blank',
                  'noopener noreferrer',
                );
              },
            },
          },
        ],
        [
          {
            name: 'period_limit',
            config: {
              type: 'TextControl',
              isInt: true,
              label: t('Number of periods'),
              renderTrigger: true,
              default: '',
              description: t(
                'Show only the N most recent periods, from 1 up to the number ' +
                  'of periods in the data. Leave empty to overlay them all.',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Legend'),
              renderTrigger: true,
              default: false,
              description: t('Whether to display the legend (toggles)'),
            },
          },
        ],
        ['color_picker'],
        [
          {
            name: 'line_interpolation',
            config: {
              type: 'SelectControl',
              label: t('Line Style'),
              renderTrigger: true,
              choices: [
                ['linear', t('Linear')],
                ['cardinal', t('Smooth')],
                ['step-before', t('Step - start')],
                ['step-after', t('Step - end')],
              ],
              default: 'linear',
              description: t('Line interpolation as defined by d3.js'),
            },
          },
        ],
      ],
    },
    {
      label: t('X Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'x_axis_label',
            config: {
              type: 'TextControl',
              label: t('X Axis Label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        [
          {
            name: 'x_axis_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('X Axis Format'),
              renderTrigger: true,
              default: 'smart_date',
              choices: D3_TIME_FORMAT_OPTIONS,
              description: t('D3 time format for the x-axis labels'),
            },
          },
        ],
      ],
    },
    {
      label: t('Y Axis'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'y_axis_label',
            config: {
              type: 'TextControl',
              label: t('Y Axis Label'),
              renderTrigger: true,
              default: '',
            },
          },
        ],
        ['y_axis_format'],
        [
          {
            name: 'y_log_scale',
            config: {
              type: 'CheckboxControl',
              label: t('Y Log Scale'),
              default: false,
              renderTrigger: true,
              description: t('Use a log scale for the Y-axis'),
            },
          },
        ],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: t('Y Axis Bounds'),
              renderTrigger: true,
              default: [null, null],
              description: t(
                'Bounds for the Y-axis. When left empty, the bounds are ' +
                  'dynamically defined based on the min/max of the data. Note that ' +
                  "this feature will only expand the axis range. It won't " +
                  "narrow the data's extent.",
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
