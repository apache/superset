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
/* eslint-disable react/jsx-key */

import { t } from '@superset-ui/core';
import {
  ControlPanelSectionConfig,
  ControlSubSectionHeader,
  CustomControlItem,
  D3_TIME_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';

/*
  Plugins in question:

  AreaChartPlugin,
  BarChartPlugin,
  BubbleChartPlugin,
  BulletChartPlugin,
  CompareChartPlugin,
  DistBarChartPlugin,
  DualLineChartPlugin,
  LineChartPlugin,
  LineMultiChartPlugin,
  PieChartPlugin,
  TimePivotChartPlugin,
*/

export const yAxis2Format: CustomControlItem = {
  name: 'y_axis_2_format',
  config: {
    type: 'SelectControl',
    freeForm: true,
    label: t('Right Axis Format'),
    default: 'SMART_NUMBER',
    choices: D3_FORMAT_OPTIONS,
    description: D3_FORMAT_DOCS,
  },
};

export const showMarkers: CustomControlItem = {
  name: 'show_markers',
  config: {
    type: 'CheckboxControl',
    label: t('Show Markers'),
    renderTrigger: true,
    default: false,
    description: t('Show data points as circle markers on the lines'),
  },
};

export const leftMargin: CustomControlItem = {
  name: 'left_margin',
  config: {
    type: 'SelectControl',
    freeForm: true,
    clearable: false,
    label: t('Left Margin'),
    choices: [
      ['auto', t('auto')],
      [50, '50'],
      [75, '75'],
      [100, '100'],
      [125, '125'],
      [150, '150'],
      [200, '200'],
    ],
    default: 'auto',
    renderTrigger: true,
    description: t(
      'Left margin, in pixels, allowing for more room for axis labels',
    ),
  },
};

export const yAxisShowMinmax: CustomControlItem = {
  name: 'y_axis_showminmax',
  config: {
    type: 'CheckboxControl',
    label: t('Y bounds'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the min and max values of the Y-axis'),
  },
};

export const yAxis2ShowMinmax: CustomControlItem = {
  name: 'y_axis_2_showminmax',
  config: {
    type: 'CheckboxControl',
    label: t('Y 2 bounds'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the min and max values of the Y-axis'),
  },
};

export const lineInterpolation: CustomControlItem = {
  name: 'line_interpolation',
  config: {
    type: 'SelectControl',
    label: t('Line Style'),
    renderTrigger: true,
    choices: [
      ['linear', t('linear')],
      ['basis', t('basis')],
      ['cardinal', t('cardinal')],
      ['monotone', t('monotone')],
      ['step-before', t('step-before')],
      ['step-after', t('step-after')],
    ],
    default: 'linear',
    description: t('Line interpolation as defined by d3.js'),
  },
};

export const showBrush: CustomControlItem = {
  name: 'show_brush',
  config: {
    type: 'SelectControl',
    label: t('Show Range Filter'),
    renderTrigger: true,
    clearable: false,
    default: 'auto',
    choices: [
      ['yes', t('Yes')],
      ['no', t('No')],
      ['auto', t('Auto')],
    ],
    description: t('Whether to display the time range interactive selector'),
  },
};

export const showLegend: CustomControlItem = {
  name: 'show_legend',
  config: {
    type: 'CheckboxControl',
    label: t('Legend'),
    renderTrigger: true,
    default: true,
    description: t('Whether to display the legend (toggles)'),
  },
};

export const showControls: CustomControlItem = {
  name: 'show_controls',
  config: {
    type: 'CheckboxControl',
    label: t('Extra Controls'),
    renderTrigger: true,
    default: false,
    description: t(
      'Whether to show extra controls or not. Extra controls ' +
        'include things like making mulitBar charts stacked ' +
        'or side by side.',
    ),
  },
};

export const xAxisLabel: CustomControlItem = {
  name: 'x_axis_label',
  config: {
    type: 'TextControl',
    label: t('X Axis Label'),
    renderTrigger: true,
    default: '',
  },
};

export const bottomMargin: CustomControlItem = {
  name: 'bottom_margin',
  config: {
    type: 'SelectControl',
    clearable: false,
    freeForm: true,
    label: t('Bottom Margin'),
    choices: [
      ['auto', t('auto')],
      [50, '50'],
      [75, '75'],
      [100, '100'],
      [125, '125'],
      [150, '150'],
      [200, '200'],
    ],
    default: 'auto',
    renderTrigger: true,
    description: t(
      'Bottom margin, in pixels, allowing for more room for axis labels',
    ),
  },
};

export const xTicksLayout: CustomControlItem = {
  name: 'x_ticks_layout',
  config: {
    type: 'SelectControl',
    label: t('X Tick Layout'),
    choices: [
      ['auto', t('auto')],
      ['flat', t('flat')],
      ['45°', '45°'],
      ['staggered', t('staggered')],
    ],
    default: 'auto',
    clearable: false,
    renderTrigger: true,
    description: t('The way the ticks are laid out on the X-axis'),
  },
};

export const xAxisFormat: CustomControlItem = {
  name: 'x_axis_format',
  config: {
    type: 'SelectControl',
    freeForm: true,
    label: t('X Axis Format'),
    renderTrigger: true,
    choices: D3_TIME_FORMAT_OPTIONS,
    default: 'smart_date',
    description: D3_FORMAT_DOCS,
  },
};

export const yLogScale: CustomControlItem = {
  name: 'y_log_scale',
  config: {
    type: 'CheckboxControl',
    label: t('Y Log Scale'),
    default: false,
    renderTrigger: true,
    description: t('Use a log scale for the Y-axis'),
  },
};

export const yAxisBounds: CustomControlItem = {
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
};

export const yAxis2Bounds: CustomControlItem = {
  name: 'y_axis_2_bounds',
  config: {
    type: 'BoundsControl',
    label: t('Y Axis 2 Bounds'),
    renderTrigger: true,
    default: [null, null],
    description: t(
      'Bounds for the Y-axis. When left empty, the bounds are ' +
        'dynamically defined based on the min/max of the data. Note that ' +
        "this feature will only expand the axis range. It won't " +
        "narrow the data's extent.",
    ),
  },
};

export const xAxisShowMinmax: CustomControlItem = {
  name: 'x_axis_showminmax',
  config: {
    type: 'CheckboxControl',
    label: t('X bounds'),
    renderTrigger: true,
    default: false,
    description: t('Whether to display the min and max values of the X-axis'),
  },
};

export const richTooltip: CustomControlItem = {
  name: 'rich_tooltip',
  config: {
    type: 'CheckboxControl',
    label: t('Rich Tooltip'),
    renderTrigger: true,
    default: true,
    description: t(
      'The rich tooltip shows a list of all series for that point in time',
    ),
  },
};

export const showBarValue: CustomControlItem = {
  name: 'show_bar_value',
  config: {
    type: 'CheckboxControl',
    label: t('Bar Values'),
    default: false,
    renderTrigger: true,
    description: t('Show the value on top of the bar'),
  },
};

export const barStacked: CustomControlItem = {
  name: 'bar_stacked',
  config: {
    type: 'CheckboxControl',
    label: t('Stacked Bars'),
    renderTrigger: true,
    default: false,
    description: null,
  },
};

export const reduceXTicks: CustomControlItem = {
  name: 'reduce_x_ticks',
  config: {
    type: 'CheckboxControl',
    label: t('Reduce X ticks'),
    renderTrigger: true,
    default: false,
    description: t(
      'Reduces the number of X-axis ticks to be rendered. ' +
        'If true, the x-axis will not overflow and labels may be ' +
        'missing. If false, a minimum width will be applied ' +
        'to columns and the width may overflow into an ' +
        'horizontal scroll.',
    ),
  },
};

export const yAxisLabel: CustomControlItem = {
  name: 'y_axis_label',
  config: {
    type: 'TextControl',
    label: t('Y Axis Label'),
    renderTrigger: true,
    default: '',
  },
};

export const timeSeriesSection: ControlPanelSectionConfig[] = [
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
      ['metrics'],
      ['adhoc_filters'],
      ['groupby'],
      ['limit'],
      ['timeseries_limit_metric'],
      ['order_desc'],
      [
        {
          name: 'contribution',
          config: {
            type: 'CheckboxControl',
            label: t('Contribution'),
            default: false,
            description: t('Compute the contribution to the total'),
          },
        },
      ],
      ['row_limit', null],
    ],
  },
  {
    label: t('Advanced Analytics'),
    tabOverride: 'data',
    description: t(
      'This section contains options ' +
        'that allow for advanced analytical post processing ' +
        'of query results',
    ),
    controlSetRows: [
      [
        <ControlSubSectionHeader>
          {t('Rolling Window')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'rolling_type',
          config: {
            type: 'SelectControl',
            label: t('Rolling Function'),
            default: 'None',
            choices: [
              ['None', t('None')],
              ['mean', t('mean')],
              ['sum', t('sum')],
              ['std', t('std')],
              ['cumsum', t('cumsum')],
            ],
            description: t(
              'Defines a rolling window function to apply, works along ' +
                'with the [Periods] text box',
            ),
          },
        },
      ],
      [
        {
          name: 'rolling_periods',
          config: {
            type: 'TextControl',
            label: t('Periods'),
            isInt: true,
            description: t(
              'Defines the size of the rolling window function, ' +
                'relative to the time granularity selected',
            ),
          },
        },
      ],
      [
        {
          name: 'min_periods',
          config: {
            type: 'TextControl',
            label: t('Min Periods'),
            isInt: true,
            description: t(
              'The minimum number of rolling periods required to show ' +
                'a value. For instance if you do a cumulative sum on 7 days ' +
                'you may want your "Min Period" to be 7, so that all data points ' +
                'shown are the total of 7 periods. This will hide the "ramp up" ' +
                'taking place over the first 7 periods',
            ),
          },
        },
      ],
      [
        <ControlSubSectionHeader>
          {t('Time Comparison')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'time_compare',
          config: {
            type: 'SelectControl',
            multi: true,
            freeForm: true,
            label: t('Time Shift'),
            choices: [
              ['1 day', t('1 day')],
              ['1 week', t('1 week')],
              ['28 days', t('28 days')],
              ['30 days', t('30 days')],
              ['52 weeks', t('52 weeks')],
              ['1 year', t('1 year')],
              ['104 weeks', t('104 weeks')],
              ['2 years', t('2 years')],
              ['156 weeks', t('156 weeks')],
              ['3 years', t('3 years')],
            ],
            description: t(
              'Overlay one or more timeseries from a ' +
                'relative time period. Expects relative time deltas ' +
                'in natural language (example: 24 hours, 7 days, ' +
                '52 weeks, 365 days). Free text is supported.',
            ),
          },
        },
      ],
      [
        {
          name: 'comparison_type',
          config: {
            type: 'SelectControl',
            label: t('Calculation type'),
            default: 'values',
            choices: [
              ['values', t('Actual Values')],
              ['absolute', t('Difference')],
              ['percentage', t('Percentage change')],
              ['ratio', t('Ratio')],
            ],
            description: t(
              'How to display time shifts: as individual lines; as the ' +
                'difference between the main time series and each time shift; ' +
                'as the percentage change; or as the ratio between series and time shifts.',
            ),
          },
        },
      ],
      [<ControlSubSectionHeader>{t('Resample')}</ControlSubSectionHeader>],
      [
        {
          name: 'resample_rule',
          config: {
            type: 'SelectControl',
            freeForm: true,
            label: t('Rule'),
            default: null,
            choices: [
              ['1T', t('1T')],
              ['1H', t('1H')],
              ['1D', t('1D')],
              ['7D', t('7D')],
              ['1M', t('1M')],
              ['1AS', t('1AS')],
            ],
            description: t('Pandas resample rule'),
          },
        },
      ],
      [
        {
          name: 'resample_method',
          config: {
            type: 'SelectControl',
            freeForm: true,
            label: t('Method'),
            default: null,
            choices: [
              ['asfreq', t('asfreq')],
              ['bfill', t('bfill')],
              ['ffill', t('ffill')],
              ['median', t('median')],
              ['mean', t('mean')],
              ['sum', t('sum')],
            ],
            description: t('Pandas resample method'),
          },
        },
      ],
    ],
  },
];
