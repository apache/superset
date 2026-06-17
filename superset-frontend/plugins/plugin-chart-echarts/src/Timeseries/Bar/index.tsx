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

/**
 * Timeseries Bar Chart - Glyph Pattern Implementation
 *
 * Bar Charts are used to show metrics as a series of bars.
 * Supports both vertical and horizontal orientation.
 *
 * Key characteristics:
 * - seriesType is fixed to 'bar'
 * - Supports vertical and horizontal orientation
 * - Supports stacking (Stack, Stream modes) with stackDimension
 * - No area fills or markers (bars are the visual)
 * - Supports cross-filtering, drill-to-detail, and drill-by
 * - Supports annotations (event, formula, interval, timeseries)
 * - Has ExtraControls for stack radio buttons
 *
 * Control panel simplification:
 * Uses "Primary Axis (Categories)" / "Secondary Axis (Values)" grouping
 * instead of orientation-dependent X/Y visibility toggling. The transform's
 * isHorizontal axis swap handles physical axis mapping transparently.
 */

import { t } from '@apache-superset/core/translation';
import {
  AnnotationType,
  Behavior,
  ChartProps,
  ensureIsArray,
  JsonArray,
} from '@superset-ui/core';
import {
  ControlPanelsContainerProps,
  ControlSubSectionHeader,
  D3_TIME_FORMAT_DOCS,
  DEFAULT_SORT_SERIES_DATA,
  formatSelectOptions,
  getStandardizedControls,
  sections,
  sharedControls,
  SORT_SERIES_CHOICES,
} from '@superset-ui/chart-controls';

import { defineChart } from '@superset-ui/glyph-core';
import { Checkbox, Select } from '@superset-ui/glyph-core';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesSeriesType,
  OrientationType,
  TimeseriesChartTransformedProps,
} from '../types';
import { DEFAULT_FORM_DATA, TIME_SERIES_DESCRIPTION_TEXT } from '../constants';
import buildQuery from '../buildQuery';
import {
  legendSection,
  minorTicks,
  richTooltipSection,
  seriesOrderSection,
  showValueSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
  xAxisLabelInterval,
  forceMaxInterval,
} from '../../controls';
import { StackControlsValue } from '../../constants';
import {
  transformFullTimeseriesProps,
  TimeseriesRender,
  timeseriesQueryControls,
} from '../shared';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/Bar1.png';
import example1Dark from './images/Bar1-dark.png';
import example2 from './images/Bar2.png';
import example2Dark from './images/Bar2-dark.png';
import example3 from './images/Bar3.png';
import example3Dark from './images/Bar3-dark.png';

// ============================================================================
// Types
// ============================================================================

interface BarTransformResult {
  transformedProps: TimeseriesChartTransformedProps;
}

// ============================================================================
// Constants
// ============================================================================

const { logAxis, minorSplitLine, orientation, truncateYAxis, yAxisBounds } =
  DEFAULT_FORM_DATA;

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Bar Chart'),
    description: t('Bar Charts are used to show metrics as a series of bars.'),
    category: t('Evolution'),
    tags: [
      t('ECharts'),
      t('Predictive'),
      t('Advanced-Analytics'),
      t('Time'),
      t('Transformable'),
      t('Stacked'),
      t('Bar'),
      t('Featured'),
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
      { url: example3, urlDark: example3Dark },
    ],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    supportedAnnotationTypes: [
      AnnotationType.Event,
      AnnotationType.Formula,
      AnnotationType.Interval,
      AnnotationType.Timeseries,
    ],
  },

  arguments: {
    // Show value control
    showValue: Checkbox.with({
      label: t('Show Value'),
      description: t('Show series values on the chart'),
      default: false,
    }),

    // Zoom control
    zoomable: Checkbox.with({
      label: t('Data Zoom'),
      description: t('Enable data zooming controls'),
      default: false,
    }),

    // Value axis controls
    logAxis: Checkbox.with({
      label: t('Logarithmic axis'),
      description: t('Logarithmic axis'),
      default: logAxis,
    }),

    minorSplitLine: Checkbox.with({
      label: t('Minor Split Line'),
      description: t('Draw split lines for minor axis ticks'),
      default: minorSplitLine,
    }),

    truncateYAxis: Checkbox.with({
      label: t('Truncate Axis'),
      description: t("It's not recommended to truncate axis in Bar chart."),
      default: truncateYAxis,
    }),

    // Series order controls
    sortSeriesType: Select.with({
      label: t('Sort Series By'),
      description: t(
        'Based on what should series be ordered on the chart and legend',
      ),
      options: SORT_SERIES_CHOICES.map(([value, label]) => ({
        value,
        label,
      })),
      default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
    }),

    sortSeriesAscending: Checkbox.with({
      label: t('Sort Series Ascending'),
      description: t('Sort series in ascending order'),
      default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
    }),
  },

  additionalControls: {
    query: timeseriesQueryControls,
    chartOptions: [
      // Orientation
      [
        {
          name: 'orientation',
          config: {
            type: 'RadioButtonControl',
            renderTrigger: true,
            label: t('Bar orientation'),
            default: orientation,
            options: [
              [OrientationType.Vertical, t('Vertical')],
              [OrientationType.Horizontal, t('Horizontal')],
            ],
            description: t('Orientation of bar chart'),
          },
        },
      ],
      // Chart Options
      [
        <ControlSubSectionHeader key="chart">
          {t('Chart Options')}
        </ControlSubSectionHeader>,
      ],
      ...seriesOrderSection,
      ['color_scheme'],
      ['time_shift_color'],
      ...showValueSection,
      [
        {
          name: 'stackDimension',
          config: {
            type: 'SelectControl',
            label: t('Split stack by'),
            visibility: ({ controls }: ControlPanelsContainerProps) =>
              controls?.stack?.value === StackControlsValue.Stack,
            renderTrigger: true,
            description: t(
              'Stack in groups, where each group corresponds to a dimension',
            ),
            shouldMapStateToProps: () => true,
            mapStateToProps: (state: Record<string, any>) => {
              const value: JsonArray = ensureIsArray(
                state.controls.groupby?.value,
              ) as JsonArray;
              const valueAsStringArr: string[][] = value.map(v => {
                if (v) return [v.toString(), v.toString()];
                return ['', ''];
              });
              return {
                choices: valueAsStringArr,
              };
            },
          },
        },
      ],
      [minorTicks],
      ['zoomable'],
      ...legendSection,
      // Primary Axis (Categories) - controls the dimension/time axis
      // The transform's isHorizontal swap handles physical axis mapping
      [
        <ControlSubSectionHeader key="primary">
          {t('Primary Axis (Categories)')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'x_axis_title',
          config: {
            type: 'TextControl',
            label: t('Axis Title'),
            renderTrigger: true,
            default: '',
          },
        },
      ],
      [
        {
          name: 'x_axis_title_margin',
          config: {
            type: 'SelectControl',
            freeForm: true,
            clearable: true,
            label: t('Axis title margin'),
            renderTrigger: true,
            default: sections.TITLE_MARGIN_OPTIONS[0],
            choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
          },
        },
      ],
      [
        {
          name: 'x_axis_time_format',
          config: {
            ...sharedControls.x_axis_time_format,
            default: 'smart_date',
            description: `${D3_TIME_FORMAT_DOCS}. ${TIME_SERIES_DESCRIPTION_TEXT}`,
          },
        },
      ],
      [xAxisLabelRotation],
      [xAxisLabelInterval],
      [forceMaxInterval],
      [truncateXAxis],
      [xAxisBounds],
      // Rich tooltip
      ...richTooltipSection,
      // Secondary Axis (Values) - controls the metric/value axis
      [
        <ControlSubSectionHeader key="secondary">
          {t('Secondary Axis (Values)')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'y_axis_title',
          config: {
            type: 'TextControl',
            label: t('Axis Title'),
            renderTrigger: true,
            default: '',
          },
        },
      ],
      [
        {
          name: 'y_axis_title_margin',
          config: {
            type: 'SelectControl',
            freeForm: true,
            clearable: true,
            label: t('Axis title margin'),
            renderTrigger: true,
            default: sections.TITLE_MARGIN_OPTIONS[1],
            choices: formatSelectOptions(sections.TITLE_MARGIN_OPTIONS),
          },
        },
      ],
      [
        {
          name: 'y_axis_title_position',
          config: {
            type: 'SelectControl',
            freeForm: true,
            clearable: false,
            label: t('Axis title position'),
            renderTrigger: true,
            default: sections.TITLE_POSITION_OPTIONS[0][0],
            choices: sections.TITLE_POSITION_OPTIONS,
          },
        },
      ],
      ['y_axis_format'],
      ['currency_format'],
      [
        {
          name: 'logAxis',
          config: {
            type: 'CheckboxControl',
            label: t('Logarithmic axis'),
            renderTrigger: true,
            default: logAxis,
            description: t('Logarithmic axis'),
          },
        },
      ],
      [
        {
          name: 'minorSplitLine',
          config: {
            type: 'CheckboxControl',
            label: t('Minor Split Line'),
            renderTrigger: true,
            default: minorSplitLine,
            description: t('Draw split lines for minor axis ticks'),
          },
        },
      ],
      [
        {
          name: 'truncateYAxis',
          config: {
            type: 'CheckboxControl',
            label: t('Truncate Axis'),
            default: truncateYAxis,
            renderTrigger: true,
            description: t(
              "It's not recommended to truncate axis in Bar chart.",
            ),
          },
        },
      ],
      [
        {
          name: 'y_axis_bounds',
          config: {
            type: 'BoundsControl',
            label: t('Axis Bounds'),
            renderTrigger: true,
            default: yAxisBounds,
            description: t(
              'Bounds for the axis. When left empty, the bounds are ' +
                'dynamically defined based on the min/max of the data. Note that ' +
                "this feature will only expand the axis range. It won't " +
                "narrow the data's extent.",
            ),
            visibility: ({ controls }: ControlPanelsContainerProps) =>
              Boolean(controls?.truncateYAxis?.value),
          },
        },
      ],
    ],
  },

  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
    groupby: getStandardizedControls().popAllColumns(),
  }),

  buildQuery,

  transform: (chartProps: ChartProps): BarTransformResult => {
    const transformedProps = transformFullTimeseriesProps(
      chartProps as unknown as EchartsTimeseriesChartProps,
      { seriesType: EchartsTimeseriesSeriesType.Bar },
    );
    return { transformedProps };
  },

  render: ({ transformedProps }) => (
    <TimeseriesRender transformedProps={transformedProps} hasExtraControls />
  ),
});
