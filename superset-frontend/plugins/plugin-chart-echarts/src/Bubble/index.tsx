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
 * ECharts Bubble Chart - Glyph Pattern Implementation
 *
 * Visualizes a metric across three dimensions of data (X axis, Y axis, bubble size).
 * Bubbles from the same group can be showcased using bubble color.
 */

import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { ScatterSeriesOption } from 'echarts/charts';
import { extent } from 'd3-array';
import {
  Behavior,
  buildQueryContext,
  CategoricalColorNamespace,
  ensureIsArray,
  getMetricLabel,
  getNumberFormatter,
  NumberFormatter,
  QueryFormData,
  QueryFormColumn,
  SetDataMaskHook,
  ContextMenuFilters,
  tooltipHtml,
  AxisType,
} from '@superset-ui/core';

import {
  defineChart,
  Metric,
  Dimension,
  Text,
  Checkbox,
  Select,
  Slider,
  Bounds,
  ChartProps,
  NumberFormat,
  ShowLegend,
  LegendType as LegendTypePreset,
  LegendOrientation as LegendOrientationPreset,
  LegendSort,
  BoundsValue,
  // Cross-filter utilities
  isDataPointFiltered,
  createSelectedValuesMap,
} from '@superset-ui/glyph-core';
import { allEventHandlers } from '../utils/eventHandlers';

import { defaultGrid } from '../defaults';
import { getLegendProps, getMinAndMaxFromBounds } from '../utils/series';
import { parseAxisBound } from '../utils/controls';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPadding } from '../Timeseries/transformers';
import { convertInteger } from '../utils/convertInteger';
import Echart from '../components/Echart';
import { Refs, LegendOrientation, LegendType } from '../types';
import { OpacityEnum, NULL_STRING } from '../constants';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.png';
import example1Dark from './images/example1-dark.png';
import example2 from './images/example2.png';
import example2Dark from './images/example2-dark.png';

// ============================================================================
// Constants
// ============================================================================

const MINIMUM_BUBBLE_SIZE = 5;

const MAX_BUBBLE_SIZE_OPTIONS = [
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: '75', value: '75' },
  { label: '100', value: '100' },
];

const AXIS_TITLE_MARGIN_OPTIONS = [
  { label: '15', value: 15 },
  { label: '30', value: 30 },
  { label: '45', value: 45 },
  { label: '60', value: 60 },
  { label: '75', value: 75 },
  { label: '90', value: 90 },
];

const X_AXIS_ROTATION_OPTIONS = [
  { label: '0°', value: 0 },
  { label: '45°', value: 45 },
];

const Y_AXIS_ROTATION_OPTIONS = [
  { label: '0°', value: 0 },
  { label: '45°', value: 45 },
];

// ============================================================================
// Types
// ============================================================================

interface BubbleTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsCoreOption;
    formData: Record<string, unknown>;
    // Cross-filter props
    groupby: QueryFormColumn[];
    labelMap: Record<string, string[]>;
    setDataMask: SetDataMaskHook;
    selectedValues: Record<number, string>;
    emitCrossFilters?: boolean;
    onContextMenu?: (
      clientX: number,
      clientY: number,
      filters?: ContextMenuFilters,
    ) => void;
    coltypeMapping?: Record<string, number>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

const isIterable = (obj: unknown): obj is Iterable<unknown> =>
  obj != null &&
  typeof (obj as Iterable<unknown>)[Symbol.iterator] === 'function';

function normalizeSymbolSize(
  nodes: ScatterSeriesOption[],
  maxBubbleValue: number,
) {
  const [bubbleMinValue, bubbleMaxValue] = extent<ScatterSeriesOption, number>(
    nodes,
    x => {
      const tmpValue = x.data?.[0];
      const result = isIterable(tmpValue) ? (tmpValue as number[])[2] : null;
      if (typeof result === 'number') {
        return result;
      }
      return null;
    },
  );
  if (bubbleMinValue !== undefined && bubbleMaxValue !== undefined) {
    const nodeSpread = bubbleMaxValue - bubbleMinValue;
    nodes.forEach(node => {
      const tmpValue = node.data?.[0];
      const calculated = isIterable(tmpValue)
        ? (tmpValue as number[])[2]
        : null;
      if (typeof calculated === 'number') {
        // eslint-disable-next-line no-param-reassign
        node.symbolSize =
          (((calculated - bubbleMinValue) / nodeSpread) *
            (maxBubbleValue * 2) || 0) + MINIMUM_BUBBLE_SIZE;
      }
    });
  }
}

function formatTooltip(
  params: { data: (string | number | null)[] },
  xAxisLabel: string,
  yAxisLabel: string,
  sizeLabel: string,
  xAxisFormatter: NumberFormatter,
  yAxisFormatter: NumberFormatter,
  tooltipSizeFormatter: NumberFormatter,
) {
  const title = params.data[4]
    ? `${params.data[4]} (${params.data[3]})`
    : String(params.data[3]);

  return tooltipHtml(
    [
      [xAxisLabel, xAxisFormatter(params.data[0] as number)],
      [yAxisLabel, yAxisFormatter(params.data[1] as number)],
      [sizeLabel, tooltipSizeFormatter(params.data[2] as number)],
    ],
    title,
  );
}

// ============================================================================
// Build Query - exported for testing
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const columns = [
    ...ensureIsArray(formData.entity),
    ...ensureIsArray(formData.series),
  ];

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      orderby: baseQueryObject.orderby
        ? [[baseQueryObject.orderby[0], !baseQueryObject.order_desc]]
        : undefined,
    },
  ]);
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Bubble Chart'),
    description: t(
      'Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.',
    ),
    category: t('Correlation'),
    tags: [
      t('Multi-Dimensions'),
      t('Comparison'),
      t('Scatter'),
      t('Time'),
      t('Trend'),
      t('ECharts'),
      t('Featured'),
    ],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
  },

  arguments: {
    // Query section
    series: Dimension.with({
      label: t('Series'),
      description: t('Dimension to group bubbles by color'),
      multi: false,
    }),

    entity: Dimension.with({
      label: t('Entity'),
      description: t('Entity column for bubble identification'),
      multi: false,
    }),

    x: Metric.with({
      label: t('X Axis'),
      description: t('Metric for X axis position'),
      multi: false,
    }),

    y: Metric.with({
      label: t('Y Axis'),
      description: t('Metric for Y axis position'),
      multi: false,
    }),

    size: Metric.with({
      label: t('Bubble Size'),
      description: t('Metric that determines bubble size'),
      multi: false,
    }),

    // Chart Options
    maxBubbleSize: Select.with({
      label: t('Max Bubble Size'),
      description: t('Maximum size of the bubbles'),
      options: MAX_BUBBLE_SIZE_OPTIONS,
      default: '25',
    }),

    tooltipSizeFormat: NumberFormat.with({
      label: t('Bubble size number format'),
      description: t('Number format for bubble size in tooltip'),
    }),

    opacity: Slider.with({
      label: t('Bubble Opacity'),
      description: t(
        'Opacity of bubbles, 0 means completely transparent, 1 means opaque',
      ),
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.1,
    }),

    // Legend
    showLegend: ShowLegend,
    legendType: LegendTypePreset,
    legendOrientation: LegendOrientationPreset,
    legendSort: LegendSort,

    // X Axis
    xAxisLabel: Text.with({
      label: t('X Axis Title'),
      description: t('Title for the X axis'),
      default: '',
    }),

    xAxisLabelRotation: Select.with({
      label: t('Rotate x axis label'),
      description: t('Rotation angle for X axis labels'),
      options: X_AXIS_ROTATION_OPTIONS,
      default: 0,
    }),

    xAxisTitleMargin: Select.with({
      label: t('X axis title margin'),
      description: t('Margin for X axis title'),
      options: AXIS_TITLE_MARGIN_OPTIONS,
      default: 30,
    }),

    xAxisFormat: NumberFormat.with({
      label: t('X Axis Format'),
      description: t('Number format for X axis'),
    }),

    logXAxis: Checkbox.with({
      label: t('Logarithmic x-axis'),
      description: t('Use logarithmic scale for X axis'),
      default: false,
    }),

    truncateXAxis: Checkbox.with({
      label: t('Truncate X Axis'),
      description: t(
        'Truncate X Axis. Can be overridden by specifying a min or max bound.',
      ),
      default: false,
    }),

    xAxisBounds: Bounds.with({
      label: t('X Axis Bounds'),
      description: t(
        'Bounds for the X-axis. When left empty, the bounds are dynamically defined based on the min/max of the data.',
      ),
      default: [null, null],
    }),

    // Y Axis
    yAxisLabel: Text.with({
      label: t('Y Axis Title'),
      description: t('Title for the Y axis'),
      default: '',
    }),

    yAxisLabelRotation: Select.with({
      label: t('Rotate y axis label'),
      description: t('Rotation angle for Y axis labels'),
      options: Y_AXIS_ROTATION_OPTIONS,
      default: 0,
    }),

    yAxisTitleMargin: Select.with({
      label: t('Y axis title margin'),
      description: t('Margin for Y axis title'),
      options: AXIS_TITLE_MARGIN_OPTIONS,
      default: 30,
    }),

    yAxisFormat: NumberFormat.with({
      label: t('Y Axis Format'),
      description: t('Number format for Y axis'),
    }),

    logYAxis: Checkbox.with({
      label: t('Logarithmic y-axis'),
      description: t('Use logarithmic scale for Y axis'),
      default: false,
    }),

    truncateYAxis: Checkbox.with({
      label: t('Truncate Y Axis'),
      description: t(
        'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
      ),
      default: false,
    }),

    yAxisBounds: Bounds.with({
      label: t('Y Axis Bounds'),
      description: t(
        'Bounds for the Y-axis. When left empty, the bounds are dynamically defined based on the min/max of the data.',
      ),
      default: [null, null],
    }),
  },

  buildQuery,

  transform: (chartProps: ChartProps): BubbleTransformResult => {
    const {
      height,
      width,
      queriesData,
      rawFormData,
      inContextMenu,
      theme,
      filterState,
      hooks,
      emitCrossFilters,
    } = chartProps;

    const { data = [] } = queriesData[0];
    const refs: Refs = {};
    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};

    // Extract form values
    const x = rawFormData.x as string;
    const y = rawFormData.y as string;
    const size = rawFormData.size as string;
    const entity = rawFormData.entity as string;
    const maxBubbleSize = Number(rawFormData.max_bubble_size || '25');
    const colorScheme = rawFormData.color_scheme as string;
    const bubbleSeries = rawFormData.series as string | undefined;
    const bubbleXAxisTitle = (rawFormData.x_axis_label as string) || '';
    const bubbleYAxisTitle = (rawFormData.y_axis_label as string) || '';
    const xAxisBounds = (rawFormData.x_axis_bounds as BoundsValue) || [
      null,
      null,
    ];
    const xAxisFormat = (rawFormData.x_axis_format as string) || 'SMART_NUMBER';
    const yAxisFormat = (rawFormData.y_axis_format as string) || 'SMART_NUMBER';
    const yAxisBounds = (rawFormData.y_axis_bounds as BoundsValue) || [
      null,
      null,
    ];
    const logXAxis = rawFormData.log_x_axis as boolean;
    const logYAxis = rawFormData.log_y_axis as boolean;
    const xAxisTitleMargin = rawFormData.x_axis_title_margin as number;
    const yAxisTitleMargin = rawFormData.y_axis_title_margin as number;
    const truncateXAxis = rawFormData.truncate_x_axis as boolean;
    const truncateYAxis = rawFormData.truncate_y_axis as boolean;
    const xAxisLabelRotation = rawFormData.x_axis_label_rotation as number;
    const yAxisLabelRotation = rawFormData.y_axis_label_rotation as number;
    const tooltipSizeFormat =
      (rawFormData.tooltip_size_format as string) || 'SMART_NUMBER';
    const opacity = (rawFormData.opacity as number) ?? 0.6;
    const showLegend = rawFormData.show_legend as boolean;
    const legendOrientation = rawFormData.legend_orientation as string;
    const legendMargin = rawFormData.legend_margin as number;
    const legendType = rawFormData.legend_type as string;
    const legendSort = rawFormData.legend_sort as string;
    const sliceId = rawFormData.slice_id as number | undefined;

    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

    const legends = new Set<string>();
    const series: ScatterSeriesOption[] = [];
    const seriesNames: string[] = [];

    const xAxisLabel: string = getMetricLabel(x);
    const yAxisLabel: string = getMetricLabel(y);
    const sizeLabel: string = getMetricLabel(size);

    // Build groupby from series and/or entity columns for cross-filtering
    const groupby: QueryFormColumn[] = [];
    if (bubbleSeries) {
      groupby.push(bubbleSeries);
    }

    // Build labelMap for cross-filtering
    const labelMap: Record<string, string[]> = {};

    data.forEach((datum: Record<string, unknown>) => {
      const dataName = bubbleSeries ? datum[bubbleSeries] : datum[entity];
      const name = dataName ? String(dataName) : NULL_STRING;
      const bubbleSeriesValue = bubbleSeries ? datum[bubbleSeries] : null;

      // Build labelMap entry
      if (bubbleSeries) {
        labelMap[name] = [String(datum[bubbleSeries] ?? '')];
      }

      // Check if this data point is filtered
      const isFiltered = isDataPointFiltered(filterState, name);

      series.push({
        name,
        data: [
          [
            datum[xAxisLabel] as number,
            datum[yAxisLabel] as number,
            datum[sizeLabel] as number,
            datum[entity] as string | number,
            bubbleSeriesValue as string | number | null,
          ],
        ],
        type: 'scatter',
        itemStyle: {
          color: colorFn(name, sliceId),
          opacity: isFiltered ? OpacityEnum.SemiTransparent : opacity,
        },
      });
      legends.add(name);
      seriesNames.push(name);
    });

    // Create selectedValues map for cross-filtering
    const selectedValues = createSelectedValuesMap(filterState, seriesNames);

    normalizeSymbolSize(series, maxBubbleSize);

    const xAxisFormatter = getNumberFormatter(xAxisFormat);
    const yAxisFormatter = getNumberFormatter(yAxisFormat);
    const tooltipSizeFormatter = getNumberFormatter(tooltipSizeFormat);

    const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
    const [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);

    const padding = getPadding(
      showLegend,
      legendOrientation as LegendOrientation,
      true,
      false,
      legendMargin,
      true,
      'Left',
      convertInteger(yAxisTitleMargin),
      convertInteger(xAxisTitleMargin),
    );

    const xAxisType = logXAxis ? AxisType.Log : AxisType.Value;
    const echartOptions: EChartsCoreOption = {
      series,
      xAxis: {
        axisLabel: { formatter: xAxisFormatter },
        splitLine: {
          lineStyle: {
            type: 'dashed',
          },
        },
        nameRotate: xAxisLabelRotation,
        scale: true,
        name: bubbleXAxisTitle,
        nameLocation: 'middle',
        nameTextStyle: {
          fontWeight: 'bolder',
        },
        nameGap: convertInteger(xAxisTitleMargin),
        type: xAxisType,
        ...getMinAndMaxFromBounds(xAxisType, truncateXAxis, xAxisMin, xAxisMax),
      },
      yAxis: {
        axisLabel: { formatter: yAxisFormatter },
        splitLine: {
          lineStyle: {
            type: 'dashed',
          },
        },
        nameRotate: yAxisLabelRotation,
        scale: truncateYAxis,
        name: bubbleYAxisTitle,
        nameLocation: 'middle',
        nameTextStyle: {
          fontWeight: 'bolder',
        },
        nameGap: convertInteger(yAxisTitleMargin),
        min: yAxisMin,
        max: yAxisMax,
        type: logYAxis ? AxisType.Log : AxisType.Value,
      },
      legend: {
        ...getLegendProps(
          legendType as LegendType,
          legendOrientation as LegendOrientation,
          showLegend,
          theme,
        ),
        data: Array.from(legends).sort((a: string, b: string) => {
          if (!legendSort) return 0;
          return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
        }),
      },
      tooltip: {
        show: !inContextMenu,
        ...getDefaultTooltip(refs),
        formatter: (params: unknown): string =>
          formatTooltip(
            params as { data: (string | number | null)[] },
            xAxisLabel,
            yAxisLabel,
            sizeLabel,
            xAxisFormatter,
            yAxisFormatter,
            tooltipSizeFormatter,
          ),
      },
      grid: { ...defaultGrid, ...padding },
    };

    return {
      transformedProps: {
        refs,
        height,
        width,
        echartOptions,
        formData: rawFormData,
        // Cross-filter props
        groupby,
        labelMap,
        setDataMask,
        selectedValues,
        emitCrossFilters,
        onContextMenu,
      },
    };
  },

  render: ({ transformedProps }) => {
    const { height, width, echartOptions, refs, formData, selectedValues } =
      transformedProps;

    // Use allEventHandlers for cross-filtering support
    const eventHandlers = allEventHandlers(transformedProps);

    return (
      <Echart
        height={height}
        width={width}
        echartOptions={echartOptions}
        refs={refs}
        eventHandlers={eventHandlers}
        selectedValues={selectedValues}
        vizType={formData.vizType as string}
      />
    );
  },
});
