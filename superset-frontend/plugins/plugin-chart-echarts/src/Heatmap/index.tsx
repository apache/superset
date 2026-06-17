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
import { logging } from '@apache-superset/core/utils';
import { t } from '@apache-superset/core/translation';
import { GenericDataType } from '@apache-superset/core/common';
import {
  buildQueryContext,
  Currency,
  DataRecordValue,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getSequentialSchemeRegistry,
  getTimeFormatter,
  getValueFormatter,
  getXAxisColumn,
  NumberFormats,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
  QueryFormOrderBy,
  rgbToHex,
  addAlpha,
  RgbaColor,
  tooltipHtml,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  formatSelectOptionsForRange,
  getStandardizedControls,
  rankOperator,
} from '@superset-ui/chart-controls';
import memoizeOne from 'memoize-one';
import { maxBy, minBy } from 'lodash';
import type { ComposeOption } from 'echarts/core';
import type { HeatmapSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';

import { defineChart } from '@superset-ui/glyph-core';
import { Checkbox, Select, Slider } from '@superset-ui/glyph-core';
import { ShowLegend } from '@superset-ui/glyph-core';
import Echart from '../components/Echart';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs, BaseChartProps, BaseTransformedProps } from '../types';
import { parseAxisBound } from '../utils/controls';
import { getPercentFormatter } from '../utils/formatters';
import { xAxisLabelRotation } from '../controls';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.png';
import example1Dark from './images/example1-dark.png';
import example2 from './images/example2.png';
import example2Dark from './images/example2-dark.png';
import example3 from './images/example3.png';
import example3Dark from './images/example3-dark.png';

// ============================================================================
// Types
// ============================================================================

type EChartsOption = ComposeOption<HeatmapSeriesOption>;

interface HeatmapFormData extends QueryFormData {
  bottomMargin: string;
  currencyFormat?: Currency;
  leftMargin: string;
  legendType: 'continuous' | 'piecewise';
  linearColorScheme?: string;
  metric: QueryFormMetric;
  normalizeAcross: 'heatmap' | 'x' | 'y';
  normalized?: boolean;
  borderColor: RgbaColor;
  borderWidth: number;
  showLegend?: boolean;
  showPercentage?: boolean;
  showValues?: boolean;
  sortXAxis?: string;
  sortYAxis?: string;
  timeFormat?: string;
  xAxis: QueryFormColumn;
  xAxisLabelRotation: number;
  xscaleInterval: number;
  valueBounds: [number | undefined | null, number | undefined | null];
  yAxisFormat?: string;
  yscaleInterval: number;
}

interface HeatmapChartProps extends BaseChartProps<HeatmapFormData> {
  formData: HeatmapFormData;
}

type HeatmapTransformedProps = BaseTransformedProps<HeatmapFormData>;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ECHARTS_BOUNDS = [0, 200];

const SORT_AXIS_OPTIONS = [
  { label: t('Axis ascending'), value: 'alpha_asc' },
  { label: t('Axis descending'), value: 'alpha_desc' },
  { label: t('Metric ascending'), value: 'value_asc' },
  { label: t('Metric descending'), value: 'value_desc' },
];

const NORMALIZE_ACROSS_OPTIONS = [
  { label: t('heatmap'), value: 'heatmap' },
  { label: t('x'), value: 'x' },
  { label: t('y'), value: 'y' },
];

const LEGEND_TYPE_OPTIONS = [
  { label: t('Continuous'), value: 'continuous' },
  { label: t('Piecewise'), value: 'piecewise' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract unique values for an axis from the data.
 * Filters out null and undefined values.
 */
function extractUniqueValues(
  data: Record<string, DataRecordValue>[],
  columnName: string,
): DataRecordValue[] {
  const uniqueSet = new Set<DataRecordValue>();
  data.forEach(row => {
    const value = row[columnName];
    if (value !== null && value !== undefined) {
      uniqueSet.add(value);
    }
  });
  return Array.from(uniqueSet);
}

/**
 * Sort axis values based on the sort configuration.
 * Supports alphabetical (with numeric awareness) and metric value-based sorting.
 */
function sortAxisValues(
  values: DataRecordValue[],
  data: Record<string, DataRecordValue>[],
  sortOption: string | undefined,
  metricLabel: string,
  axisColumn: string,
): DataRecordValue[] {
  if (!sortOption) {
    return values;
  }

  const isAscending = sortOption.includes('asc');
  const isValueSort = sortOption.includes('value');

  if (isValueSort) {
    const valueMap = new Map<DataRecordValue, number>();
    data.forEach(row => {
      const axisValue = row[axisColumn];
      const metricValue = row[metricLabel];
      if (
        axisValue !== null &&
        axisValue !== undefined &&
        typeof metricValue === 'number'
      ) {
        const current = valueMap.get(axisValue) || 0;
        valueMap.set(axisValue, current + metricValue);
      }
    });

    return [...values].sort((a, b) => {
      const aValue = valueMap.get(a) || 0;
      const bValue = valueMap.get(b) || 0;
      return isAscending ? aValue - bValue : bValue - aValue;
    });
  }

  // Alphabetical/lexicographic sort
  return [...values].sort((a, b) => {
    const aNum = typeof a === 'number' ? a : Number(a);
    const bNum = typeof b === 'number' ? b : Number(b);
    const aIsNumeric = Number.isFinite(aNum);
    const bIsNumeric = Number.isFinite(bNum);

    if (aIsNumeric && bIsNumeric) {
      return isAscending ? aNum - bNum : bNum - aNum;
    }

    const aStr = String(a);
    const bStr = String(b);
    const comparison = aStr.localeCompare(bStr, undefined, { numeric: true });
    return isAscending ? comparison : -comparison;
  });
}

// Calculated totals per x and y categories plus total
const calculateTotals = memoizeOne(
  (
    data: Record<string, unknown>[],
    xAxis: string,
    groupby: string,
    metric: string,
  ) =>
    data.reduce(
      (
        acc: {
          x: Record<string, number>;
          y: Record<string, number>;
          total: number;
        },
        row,
      ) => {
        const value = row[metric];
        if (typeof value !== 'number') {
          return acc;
        }
        const x = row[xAxis] as string;
        const y = row[groupby] as string;
        const xTotal = acc.x[x] || 0;
        const yTotal = acc.y[y] || 0;
        return {
          x: { ...acc.x, [x]: xTotal + value },
          y: { ...acc.y, [y]: yTotal + value },
          total: acc.total + value,
        };
      },
      {
        x: {} as Record<string, number>,
        y: {} as Record<string, number>,
        total: 0,
      },
    ),
);

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Heatmap'),
    description: t(
      'Visualize a related metric across pairs of groups. Heatmaps excel at showcasing the correlation or strength between two groups. Color is used to emphasize the strength of the link between each pair of groups.',
    ),
    category: t('Correlation'),
    tags: [
      t('Business'),
      t('Intensity'),
      t('Density'),
      t('Single Metric'),
      t('ECharts'),
      t('Featured'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
      { url: example3, urlDark: example3Dark },
    ],
  },

  arguments: {
    // Query section controls are in additionalControls
    sortXAxis: Select.with({
      label: t('Sort X Axis'),
      options: SORT_AXIS_OPTIONS,
      default: undefined,
      clearable: true,
      renderTrigger: false,
    }),
    sortYAxis: Select.with({
      label: t('Sort Y Axis'),
      options: SORT_AXIS_OPTIONS,
      default: undefined,
      clearable: true,
      renderTrigger: false,
    }),
    normalizeAcross: Select.with({
      label: t('Normalize Across'),
      description: t(
        'Color will be shaded based the normalized (0% to 100%) value of a given cell against the other cells in the selected range.',
      ),
      options: NORMALIZE_ACROSS_OPTIONS,
      default: 'heatmap',
      renderTrigger: false,
    }),
    // Chart Options
    legendType: Select.with({
      label: t('Legend Type'),
      options: LEGEND_TYPE_OPTIONS,
      default: 'continuous',
    }),
    showLegend: ShowLegend,
    borderWidth: Slider.with({
      label: t('Border width'),
      description: t('The width of the elements border'),
      min: 0,
      max: 2,
      step: 0.1,
      default: 0,
    }),
    showPercentage: Checkbox.with({
      label: t('Show percentage'),
      description: t('Whether to include the percentage in the tooltip'),
      default: true,
    }),
    showValues: Checkbox.with({
      label: t('Show Values'),
      description: t(
        'Whether to display the numerical values within the cells',
      ),
      default: false,
    }),
    normalized: Checkbox.with({
      label: t('Normalized'),
      description: t(
        'Whether to apply a normal distribution based on rank on the color scale',
      ),
      default: false,
    }),
  },

  // Many Heatmap controls use special control types (ColorPicker, Bounds, etc.)
  // that need additionalControls
  additionalControls: {
    query: [
      ['x_axis'],
      ['time_grain_sqla'],
      ['groupby'],
      ['metric'],
      ['adhoc_filters'],
      ['row_limit'],
    ],
    chartOptions: [
      ['linear_color_scheme'],
      [
        {
          name: 'border_color',
          config: {
            type: 'ColorPickerControl',
            label: t('Border color'),
            renderTrigger: true,
            description: t('The color of the elements border'),
            default: { r: 0, g: 0, b: 0, a: 1 },
          },
        },
      ],
      [
        {
          name: 'xscale_interval',
          config: {
            type: 'SelectControl',
            label: t('X-scale interval'),
            renderTrigger: true,
            choices: [[-1, t('Auto')]].concat(
              formatSelectOptionsForRange(1, 50),
            ),
            default: -1,
            clearable: false,
            description: t(
              'Number of steps to take between ticks when displaying the X scale',
            ),
          },
        },
      ],
      [
        {
          name: 'yscale_interval',
          config: {
            type: 'SelectControl',
            label: t('Y-scale interval'),
            choices: [[-1, t('Auto')]].concat(
              formatSelectOptionsForRange(1, 50),
            ),
            default: -1,
            clearable: false,
            renderTrigger: true,
            description: t(
              'Number of steps to take between ticks when displaying the Y scale',
            ),
          },
        },
      ],
      [
        {
          name: 'left_margin',
          config: {
            type: 'SelectControl',
            freeForm: true,
            clearable: false,
            label: t('Left Margin'),
            choices: [
              ['auto', t('Auto')],
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
        },
      ],
      [
        {
          name: 'bottom_margin',
          config: {
            type: 'SelectControl',
            clearable: false,
            freeForm: true,
            label: t('Bottom Margin'),
            choices: [
              ['auto', t('Auto')],
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
        },
      ],
      [
        {
          name: 'value_bounds',
          config: {
            type: 'BoundsControl',
            label: t('Value bounds'),
            renderTrigger: true,
            default: [null, null],
            description: t('Hard value bounds applied for color coding.'),
          },
        },
      ],
      ['y_axis_format'],
      ['x_axis_time_format'],
      [xAxisLabelRotation],
      ['currency_format'],
    ],
  },

  controlOverrides: {
    groupby: {
      label: t('Y-Axis'),
      description: t('Dimension to use on y-axis.'),
      multi: false,
      validators: [validateNonEmpty],
    },
    y_axis_format: {
      label: t('Value Format'),
    },
  },

  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),

  buildQuery: (formData: QueryFormData) => {
    const { groupby, x_axis: xAxis } = formData;
    const normalizeAcross = formData.normalize_across;
    const sortXAxis = formData.sort_x_axis;
    const sortYAxis = formData.sort_y_axis;
    const metric = getMetricLabel(formData.metric);
    const columns = [
      ...ensureIsArray(getXAxisColumn(formData)),
      ...ensureIsArray(groupby),
    ];
    const orderby: QueryFormOrderBy[] = [];
    if (sortXAxis) {
      orderby.push([
        sortXAxis.includes('value') ? metric : columns[0],
        sortXAxis.includes('asc'),
      ]);
    }
    if (sortYAxis) {
      orderby.push([
        sortYAxis.includes('value') ? metric : columns[1],
        sortYAxis.includes('asc'),
      ]);
    }
    const groupBy =
      normalizeAcross === 'x'
        ? getColumnLabel(xAxis)
        : normalizeAcross === 'y'
          ? getColumnLabel(groupby as unknown as QueryFormColumn)
          : undefined;
    return buildQueryContext(formData, baseQueryObject => [
      {
        ...baseQueryObject,
        columns,
        orderby,
        post_processing: [
          rankOperator(formData, baseQueryObject, {
            metric,
            group_by: groupBy,
          }),
        ],
      },
    ]);
  },

  transform: (
    chartProps: HeatmapChartProps,
  ): { transformedProps: HeatmapTransformedProps } => {
    const refs: Refs = {};
    const { width, height, formData, queriesData, datasource, theme } =
      chartProps;
    const {
      bottomMargin,
      xAxis,
      groupby,
      linearColorScheme,
      leftMargin,
      legendType = 'continuous',
      metric = '',
      normalizeAcross,
      normalized,
      borderColor,
      borderWidth = 0,
      showLegend,
      showPercentage,
      showValues,
      xscaleInterval,
      yscaleInterval,
      valueBounds,
      yAxisFormat,
      xAxisTimeFormat,
      xAxisLabelRotation: rotation,
      currencyFormat,
      sortXAxis,
      sortYAxis,
    } = formData;
    const metricLabel = getMetricLabel(metric);
    const xAxisLabel = getColumnLabel(xAxis);
    const yAxisLabel = getColumnLabel(groupby as unknown as QueryFormColumn);
    const { data, colnames, coltypes } = queriesData[0];
    const { columnFormats = {}, currencyFormats = {} } = datasource;
    const colorColumn = normalized ? 'rank' : metricLabel;
    const colors = getSequentialSchemeRegistry().get(linearColorScheme)?.colors;
    const getAxisFormatter =
      (colType: GenericDataType) => (value: number | string) => {
        if (colType === GenericDataType.Temporal) {
          if (typeof value === 'string') {
            return getTimeFormatter(xAxisTimeFormat)(
              Number.parseInt(value, 10),
            );
          }
          return getTimeFormatter(xAxisTimeFormat)(value);
        }
        return String(value);
      };

    const xAxisFormatter = getAxisFormatter(coltypes[0]);
    const yAxisFormatter = getAxisFormatter(coltypes[1]);
    const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);
    const valueFormatter = getValueFormatter(
      metric,
      currencyFormats,
      columnFormats,
      yAxisFormat,
      currencyFormat,
    );

    let [min, max] = (valueBounds || []).map(parseAxisBound);
    if (min === undefined) {
      min =
        (minBy(data, row => row[colorColumn])?.[colorColumn] as number) ||
        DEFAULT_ECHARTS_BOUNDS[0];
    }
    if (max === undefined) {
      max =
        (maxBy(data, row => row[colorColumn])?.[colorColumn] as number) ||
        DEFAULT_ECHARTS_BOUNDS[1];
    }

    // Extract and sort unique axis values
    const xAxisColumnName = colnames[0];
    const yAxisColumnName = colnames[1];

    const xAxisValues = extractUniqueValues(data, xAxisColumnName);
    const yAxisValues = extractUniqueValues(data, yAxisColumnName);

    const sortedXAxisValues = sortAxisValues(
      xAxisValues,
      data,
      sortXAxis,
      metricLabel,
      xAxisColumnName,
    );
    const sortedYAxisValues = sortAxisValues(
      yAxisValues,
      data,
      sortYAxis,
      metricLabel,
      yAxisColumnName,
    );

    // Create lookup maps for axis indices
    const xAxisIndexMap = new Map<DataRecordValue, number>(
      sortedXAxisValues.map((value, index) => [value, index]),
    );
    const yAxisIndexMap = new Map<DataRecordValue, number>(
      sortedYAxisValues.map((value, index) => [value, index]),
    );

    const series: HeatmapSeriesOption[] = [
      {
        name: metricLabel,
        type: 'heatmap',
        data: data.flatMap(row => {
          const xValue = row[xAxisColumnName];
          const yValue = row[yAxisColumnName];
          const metricValue = row[metricLabel];

          const xIndex = xAxisIndexMap.get(xValue);
          const yIndex = yAxisIndexMap.get(yValue);

          if (xIndex === undefined || yIndex === undefined) {
            logging.warn(
              `Heatmap: Skipping row due to missing axis value. xValue: ${xValue}, yValue: ${yValue}, metricValue: ${metricValue}`,
              row,
            );
            return [];
          }
          return [[xIndex, yIndex, metricValue]];
        }) as unknown as HeatmapSeriesOption['data'],
        label: {
          show: showValues,
          formatter: (params: CallbackDataParams) => {
            const paramsValue = params.value as (string | number)[];
            return valueFormatter(
              paramsValue?.[2] as number | null | undefined,
            );
          },
        },
        itemStyle: {
          borderColor: addAlpha(
            rgbToHex(borderColor.r, borderColor.g, borderColor.b),
            borderColor.a,
          ),
          borderWidth,
        },
        emphasis: {
          itemStyle: {
            borderColor: 'transparent',
            shadowBlur: 10,
            shadowColor: addAlpha(theme.colorText, 0.3),
          },
        },
      },
    ];

    const echartOptions: EChartsOption = {
      grid: {
        containLabel: true,
        bottom: bottomMargin,
        left: leftMargin,
      },
      series,
      tooltip: {
        ...getDefaultTooltip(refs),
        formatter: (params: CallbackDataParams) => {
          const totals = calculateTotals(
            data,
            xAxisLabel,
            yAxisLabel,
            metricLabel,
          ) as {
            x: Record<string, number>;
            y: Record<string, number>;
            total: number;
          };
          const paramsValue = params.value as (string | number)[];
          const x = paramsValue?.[0];
          const y = paramsValue?.[1];
          const value = paramsValue?.[2] as number | null | undefined;
          const formattedX = xAxisFormatter(x);
          const formattedY = yAxisFormatter(y);
          const formattedValue = valueFormatter(value);
          let percentage = 0;
          let suffix = 'heatmap';
          if (typeof value === 'number') {
            if (normalizeAcross === 'x') {
              percentage = value / totals.x[String(x)];
              suffix = formattedX;
            } else if (normalizeAcross === 'y') {
              percentage = value / totals.y[String(y)];
              suffix = formattedY;
            } else {
              percentage = value / totals.total;
              suffix = 'heatmap';
            }
          }
          const title = `${formattedX} (${formattedY})`;
          const row = [colnames[2], formattedValue];
          if (showPercentage) {
            row.push(`${percentFormatter(percentage)} (${suffix})`);
          }
          return tooltipHtml([row], title);
        },
      },
      visualMap: {
        type: legendType,
        min,
        max,
        calculable: true,
        orient: 'horizontal',
        right: 0,
        top: 0,
        itemHeight: legendType === 'continuous' ? 300 : 14,
        itemWidth: 15,
        formatter: (minVal: number) => valueFormatter(minVal),
        inRange: {
          color: colors,
        },
        show: showLegend,
        dimension: normalized ? 3 : 2,
      },
      xAxis: {
        type: 'category',
        data: sortedXAxisValues,
        axisLabel: {
          formatter: xAxisFormatter,
          interval: xscaleInterval === -1 ? 'auto' : xscaleInterval - 1,
          rotate: rotation,
        },
      },
      yAxis: {
        type: 'category',
        data: sortedYAxisValues,
        axisLabel: {
          formatter: yAxisFormatter,
          interval: yscaleInterval === -1 ? 'auto' : yscaleInterval - 1,
        },
      },
    };
    return {
      transformedProps: {
        refs,
        echartOptions,
        width,
        height,
        formData,
      },
    };
  },

  render: ({ transformedProps }) => {
    const { height, width, echartOptions, refs, formData } = transformedProps;
    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        vizType={formData.vizType}
      />
    );
  },
});
