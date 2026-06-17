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
 * ECharts Waterfall Chart - Glyph Pattern Implementation
 *
 * Visualizes cumulative effect of sequentially introduced positive or negative values.
 * Uses stacked bars to show how values increase or decrease over categories/time.
 */

import { t } from '@apache-superset/core/translation';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption } from 'echarts/charts';
import type { BarDataItemOption } from 'echarts/types/src/chart/bar/BarSeries';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  buildQueryContext,
  CurrencyFormatter,
  DataRecord,
  ensureIsArray,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  isAdhocColumn,
  NumberFormatter,
  QueryFormData,
  rgbToHex,
  RgbaColor,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';

import {
  defineChart,
  Metric,
  Dimension,
  Temporal,
  Text,
  Checkbox,
  Select,
  ColorPicker,
  ChartProps,
  NumberFormat,
  Currency,
  TimeFormat,
  ShowLegend,
} from '@superset-ui/glyph-core';

import { getDefaultTooltip } from '../utils/tooltip';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getColtypesMapping } from '../utils/series';
import Echart from '../components/Echart';
import { EventHandlers, Refs } from '../types';
import { NULL_STRING } from '../constants';
import { ASSIST_MARK, LEGEND, TOKEN, TOTAL_MARK } from './constants';

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

type EChartsOption = ComposeOption<BarSeriesOption>;

type ISeriesData = {
  originalValue?: number;
  totalSum?: number;
} & BarDataItemOption;

type ICallbackDataParams = CallbackDataParams & {
  axisValueLabel: string;
  data: ISeriesData;
};

interface WaterfallTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsOption;
    formData: Record<string, unknown>;
    onLegendStateChanged?: (state: Record<string, boolean>) => void;
  };
}

// ============================================================================
// X Ticks Layout Options
// ============================================================================

const X_TICKS_LAYOUT_OPTIONS = [
  { label: t('auto'), value: 'auto' },
  { label: t('flat'), value: 'flat' },
  { label: '45°', value: '45°' },
  { label: '90°', value: '90°' },
  { label: t('staggered'), value: 'staggered' },
];

// ============================================================================
// Build Query - exported for testing
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const {
    x_axis: xAxis,
    granularity_sqla: granularitySqla,
    groupby,
  } = formData;
  const columns = [
    ...ensureIsArray(xAxis || granularitySqla),
    ...ensureIsArray(groupby),
  ];
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      orderby: columns?.map(column => [column, true]),
    },
  ]);
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTooltip({
  params,
  breakdownName,
  defaultFormatter,
  xAxisFormatter,
  totalMark,
}: {
  params: ICallbackDataParams[];
  breakdownName?: string;
  defaultFormatter: NumberFormatter | CurrencyFormatter;
  xAxisFormatter: (value: number | string, index: number) => string;
  totalMark: string;
}) {
  const series = params.find(
    param => param.seriesName !== ASSIST_MARK && param.data.value !== TOKEN,
  );

  if (!series) {
    return '';
  }

  const isTotal = series?.seriesName === totalMark;
  if (!series) {
    return NULL_STRING;
  }

  const title =
    !isTotal || breakdownName
      ? xAxisFormatter(series.name, series.dataIndex)
      : undefined;
  const rows: string[][] = [];
  if (!isTotal) {
    rows.push([
      series.seriesName!,
      defaultFormatter(series.data.originalValue),
    ]);
  }
  rows.push([totalMark, defaultFormatter(series.data.totalSum)]);
  return tooltipHtml(rows, title);
}

function transformer({
  data,
  xAxis,
  metric,
  breakdown,
  totalMark,
  showTotal,
}: {
  data: DataRecord[];
  xAxis: string;
  metric: string;
  breakdown?: string;
  totalMark: string;
  showTotal: boolean;
}) {
  const groupedData = data.reduce((acc, cur) => {
    const categoryLabel = cur[xAxis] as string;
    const categoryData = acc.get(categoryLabel) || [];
    categoryData.push(cur);
    acc.set(categoryLabel, categoryData);
    return acc;
  }, new Map<string, DataRecord[]>());

  const transformedData: DataRecord[] = [];

  if (breakdown) {
    groupedData.forEach((value, key) => {
      const tempValue = value;
      const sum = tempValue.reduce(
        (acc, cur) => acc + ((cur[metric] as number) ?? 0),
        0,
      );
      if (showTotal) {
        tempValue.push({
          [xAxis]: key,
          [breakdown]: totalMark,
          [metric]: sum,
        });
      }
      transformedData.push(...tempValue);
    });
  } else {
    let total = 0;
    groupedData.forEach((value, key) => {
      const sum = value.reduce(
        (acc, cur) => acc + ((cur[metric] as number) ?? 0),
        0,
      );
      transformedData.push({
        [xAxis]: key,
        [metric]: sum,
      });
      total += sum;
    });
    if (showTotal) {
      transformedData.push({
        [xAxis]: totalMark,
        [metric]: total,
      });
    }
  }

  return transformedData;
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Waterfall Chart'),
    description: t(
      `A waterfall chart is a form of data visualization that helps in understanding
      the cumulative effect of sequentially introduced positive or negative values.
      These intermediate values can either be time based or category based.`,
    ),
    category: t('Evolution'),
    tags: [t('Categorical'), t('Comparison'), t('ECharts'), t('Featured')],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
      { url: example3, urlDark: example3Dark },
    ],
  },

  arguments: {
    // Query section
    xAxis: Temporal.with({
      label: t('X-axis'),
      description: t('The time or category column for the x-axis'),
    }),

    groupby: Dimension.with({
      label: t('Breakdowns'),
      description: t(
        `Breaks down the series by the category specified in this control.
        This can help viewers understand how each category affects the overall value.`,
      ),
      multi: false,
    }),

    metric: Metric.with({
      label: t('Metric'),
      description: t('The metric value to display'),
      multi: false,
    }),

    // Chart Options
    showValue: Checkbox.with({
      label: t('Show Values'),
      description: t('Whether to display values on the bars'),
      default: false,
    }),

    showLegend: ShowLegend,

    // Series settings - Increase
    increaseColor: ColorPicker.with({
      label: t('Increase color'),
      description: t(
        'Select the color used for values that indicate an increase in the chart',
      ),
      default: { r: 90, g: 193, b: 137, a: 1 },
    }),

    increaseLabel: Text.with({
      label: t('Increase label'),
      description: t(
        'Customize the label displayed for increasing values in the chart tooltips and legend.',
      ),
      default: '',
    }),

    // Series settings - Decrease
    decreaseColor: ColorPicker.with({
      label: t('Decrease color'),
      description: t(
        'Select the color used for values that indicate a decrease in the chart.',
      ),
      default: { r: 224, g: 67, b: 85, a: 1 },
    }),

    decreaseLabel: Text.with({
      label: t('Decrease label'),
      description: t(
        'Customize the label displayed for decreasing values in the chart tooltips and legend.',
      ),
      default: '',
    }),

    // Series settings - Total
    showTotal: Checkbox.with({
      label: t('Show total'),
      description: t('Display cumulative total at end'),
      default: true,
    }),

    totalColor: ColorPicker.with({
      label: t('Total color'),
      description: t(
        'Select the color used for values that represent total bars in the chart',
      ),
      default: { r: 102, g: 102, b: 102, a: 1 },
    }),

    totalLabel: Text.with({
      label: t('Total label'),
      description: t(
        'Customize the label displayed for total values in the chart tooltips, legend, and chart axis.',
      ),
      default: '',
    }),

    // X Axis
    xAxisLabel: Text.with({
      label: t('X Axis Label'),
      description: t('Label for the x-axis'),
      default: '',
    }),

    xAxisTimeFormat: TimeFormat.with({
      label: t('X Axis Time Format'),
      description: t('Time format for the x-axis labels'),
    }),

    xTicksLayout: Select.with({
      label: t('X Tick Layout'),
      description: t('The way the ticks are laid out on the X-axis'),
      options: X_TICKS_LAYOUT_OPTIONS,
      default: 'auto',
    }),

    // Y Axis
    yAxisLabel: Text.with({
      label: t('Y Axis Label'),
      description: t('Label for the y-axis'),
      default: '',
    }),

    yAxisFormat: NumberFormat,

    currencyFormat: Currency,
  },

  buildQuery,

  transform: (chartProps: ChartProps): WaterfallTransformResult => {
    const {
      width,
      height,
      rawFormData,
      legendState,
      queriesData,
      hooks,
      theme,
      inContextMenu,
    } = chartProps;
    const refs: Refs = {};
    const { data = [] } = queriesData[0];
    const { colnames = [], coltypes = [] } =
      (queriesData[0] as { colnames?: string[]; coltypes?: number[] }) ?? {};
    const coltypeMapping = getColtypesMapping({ colnames, coltypes });
    const { onLegendStateChanged } = hooks;

    // Extract form values
    const currencyFormat = rawFormData.currency_format as
      | { symbol?: string; symbolPosition?: string }
      | undefined;
    const granularitySqla = (rawFormData.granularity_sqla as string) || '';
    const { groupby } = rawFormData;
    const increaseColor = (rawFormData.increase_color as RgbaColor) || {
      r: 90,
      g: 193,
      b: 137,
    };
    const decreaseColor = (rawFormData.decrease_color as RgbaColor) || {
      r: 224,
      g: 67,
      b: 85,
    };
    const totalColor = (rawFormData.total_color as RgbaColor) || {
      r: 102,
      g: 102,
      b: 102,
    };
    const metric = rawFormData.metric || '';
    const xAxis = rawFormData.x_axis;
    const xTicksLayout = rawFormData.x_ticks_layout as string;
    const xAxisTimeFormat = rawFormData.x_axis_time_format as string;
    const showLegend = rawFormData.show_legend as boolean;
    const yAxisLabel = (rawFormData.y_axis_label as string) || '';
    const xAxisLabel = (rawFormData.x_axis_label as string) || '';
    const yAxisFormat = (rawFormData.y_axis_format as string) || 'SMART_NUMBER';
    const showValue = rawFormData.show_value as boolean;
    const showTotal = rawFormData.show_total as boolean;
    const totalLabelValue = rawFormData.total_label as string;
    const increaseLabelValue = rawFormData.increase_label as string;
    const decreaseLabelValue = rawFormData.decrease_label as string;

    const defaultFormatter = currencyFormat?.symbol
      ? new CurrencyFormatter({
          d3Format: yAxisFormat,
          currency: {
            symbol: currencyFormat.symbol,
            symbolPosition: currencyFormat.symbolPosition || 'prefix',
          },
        })
      : getNumberFormatter(yAxisFormat);

    const totalMark = totalLabelValue || TOTAL_MARK;
    const legendNames = {
      INCREASE: increaseLabelValue || LEGEND.INCREASE,
      DECREASE: decreaseLabelValue || LEGEND.DECREASE,
      TOTAL: totalLabelValue || LEGEND.TOTAL,
    };

    const seriesFormatter = (params: ICallbackDataParams) => {
      const { data: paramData } = params;
      const { originalValue } = paramData;
      return defaultFormatter(originalValue as number);
    };

    const groupbyArray = ensureIsArray(groupby);
    const breakdownColumn = groupbyArray.length ? groupbyArray[0] : undefined;
    const breakdownName = isAdhocColumn(breakdownColumn)
      ? breakdownColumn.label!
      : (breakdownColumn as string);
    const xAxisColumn = xAxis || granularitySqla;
    const xAxisName = isAdhocColumn(xAxisColumn)
      ? xAxisColumn.label!
      : (xAxisColumn as string);
    const metricLabel = getMetricLabel(metric);

    const transformedData = transformer({
      data,
      breakdown: breakdownName,
      xAxis: xAxisName,
      metric: metricLabel,
      totalMark,
      showTotal,
    });

    const assistData: ISeriesData[] = [];
    const increaseData: ISeriesData[] = [];
    const decreaseData: ISeriesData[] = [];
    const totalData: ISeriesData[] = [];

    let previousTotal = 0;

    transformedData.forEach((datum, index, self) => {
      const totalSum = self.slice(0, index + 1).reduce((prev, cur, i) => {
        if (breakdownName) {
          if (cur[breakdownName] !== totalMark || i === 0) {
            return prev + ((cur[metricLabel] as number) ?? 0);
          }
        } else if (cur[xAxisName] !== totalMark) {
          return prev + ((cur[metricLabel] as number) ?? 0);
        }
        return prev;
      }, 0);

      const isTotal =
        (breakdownName && datum[breakdownName] === totalMark) ||
        datum[xAxisName] === totalMark;

      const originalValue = datum[metricLabel] as number;
      let value = originalValue;
      const oppositeSigns = Math.sign(previousTotal) !== Math.sign(totalSum);
      if (oppositeSigns) {
        value = Math.sign(value) * (Math.abs(value) - Math.abs(previousTotal));
      }

      if (isTotal) {
        increaseData.push({ value: TOKEN });
        decreaseData.push({ value: TOKEN });
        totalData.push({
          value: totalSum,
          originalValue: totalSum,
          totalSum,
        });
      } else if (value < 0) {
        increaseData.push({ value: TOKEN });
        decreaseData.push({
          value: totalSum < 0 ? value : -value,
          originalValue,
          totalSum,
        });
        totalData.push({ value: TOKEN });
      } else {
        increaseData.push({
          value: totalSum > 0 ? value : -value,
          originalValue,
          totalSum,
        });
        decreaseData.push({ value: TOKEN });
        totalData.push({ value: TOKEN });
      }

      const color = oppositeSigns
        ? value > 0
          ? rgbToHex(increaseColor.r, increaseColor.g, increaseColor.b)
          : rgbToHex(decreaseColor.r, decreaseColor.g, decreaseColor.b)
        : 'transparent';

      let opacity = 1;
      if (legendState?.[legendNames.INCREASE] === false && value > 0) {
        opacity = 0;
      } else if (legendState?.[legendNames.DECREASE] === false && value < 0) {
        opacity = 0;
      }

      if (isTotal) {
        assistData.push({ value: TOKEN });
      } else if (index === 0) {
        assistData.push({
          value: 0,
        });
      } else if (
        oppositeSigns ||
        Math.abs(totalSum) > Math.abs(previousTotal)
      ) {
        assistData.push({
          value: previousTotal,
          itemStyle: { color, opacity },
        });
      } else {
        assistData.push({
          value: totalSum,
          itemStyle: { color, opacity },
        });
      }

      previousTotal = totalSum;
    });

    const xAxisColumns: string[] = [];
    const xAxisData = transformedData.map(row => {
      let column = xAxisName;
      let rowValue = row[xAxisName];
      if (breakdownName && row[breakdownName] !== totalMark) {
        column = breakdownName;
        rowValue = row[breakdownName];
      }
      if (!rowValue) {
        rowValue = NULL_STRING;
      }
      if (typeof rowValue !== 'string' && typeof rowValue !== 'number') {
        rowValue = String(rowValue);
      }
      xAxisColumns.push(column);
      return rowValue;
    });

    const xAxisFormatter = (axisValue: number | string, index: number) => {
      if (axisValue === totalMark) {
        return totalMark;
      }
      if (coltypeMapping[xAxisColumns[index]] === GenericDataType.Temporal) {
        if (typeof axisValue === 'string') {
          return getTimeFormatter(xAxisTimeFormat)(
            Number.parseInt(axisValue, 10),
          );
        }
        return getTimeFormatter(xAxisTimeFormat)(axisValue);
      }
      return String(axisValue);
    };

    let axisLabel: {
      rotate?: number;
      hideOverlap?: boolean;
      show?: boolean;
      formatter?: typeof xAxisFormatter;
    };
    if (xTicksLayout === '45°') {
      axisLabel = { rotate: -45 };
    } else if (xTicksLayout === '90°') {
      axisLabel = { rotate: -90 };
    } else if (xTicksLayout === 'flat') {
      axisLabel = { rotate: 0 };
    } else if (xTicksLayout === 'staggered') {
      axisLabel = { rotate: -45 };
    } else {
      axisLabel = { show: true };
    }
    axisLabel.formatter = xAxisFormatter;
    axisLabel.hideOverlap = false;

    const seriesProps: Pick<BarSeriesOption, 'type' | 'stack' | 'emphasis'> = {
      type: 'bar',
      stack: 'stack',
      emphasis: {
        disabled: true,
      },
    };
    const labelProps = {
      show: showValue,
      formatter: seriesFormatter,
      color: (theme as { colorText?: string })?.colorText,
      borderColor: (theme as { colorBgBase?: string })?.colorBgBase,
      borderWidth: 1,
    };
    const barSeries: BarSeriesOption[] = [
      {
        ...seriesProps,
        name: ASSIST_MARK,
        data: assistData,
      },
      {
        ...seriesProps,
        name: legendNames.INCREASE,
        label: {
          ...labelProps,
          position: 'top',
        },
        itemStyle: {
          color: rgbToHex(increaseColor.r, increaseColor.g, increaseColor.b),
        },
        data: increaseData,
      },
      {
        ...seriesProps,
        name: legendNames.DECREASE,
        label: {
          ...labelProps,
          position: 'bottom',
        },
        itemStyle: {
          color: rgbToHex(decreaseColor.r, decreaseColor.g, decreaseColor.b),
        },
        data: decreaseData,
      },
      {
        ...seriesProps,
        name: legendNames.TOTAL,
        label: {
          ...labelProps,
          position: 'top',
        },
        itemStyle: {
          color: rgbToHex(totalColor.r, totalColor.g, totalColor.b),
        },
        data: totalData,
      },
    ];

    const sizeUnit = (theme as { sizeUnit?: number })?.sizeUnit ?? 4;
    const echartOptions: EChartsOption = {
      grid: {
        ...defaultGrid,
        top: sizeUnit * 7,
        bottom: sizeUnit * 7,
        left: sizeUnit * 5,
        right: sizeUnit * 7,
      },
      legend: {
        show: showLegend,
        selected: legendState,
        data: [legendNames.INCREASE, legendNames.DECREASE, legendNames.TOTAL],
      },
      xAxis: {
        data: xAxisData,
        type: 'category',
        name: xAxisLabel,
        nameTextStyle: {
          padding: [sizeUnit * 4, 0, 0, 0],
        },
        nameLocation: 'middle',
        axisLabel,
      },
      yAxis: {
        ...defaultYAxis,
        type: 'value',
        nameTextStyle: {
          padding: [0, 0, sizeUnit * 5, 0],
        },
        nameLocation: 'middle',
        name: yAxisLabel,
        axisLabel: { formatter: defaultFormatter },
      },
      tooltip: {
        ...getDefaultTooltip(refs),
        appendToBody: true,
        trigger: 'axis',
        show: !inContextMenu,
        formatter: (params: unknown) =>
          formatTooltip({
            params: params as ICallbackDataParams[],
            breakdownName,
            defaultFormatter,
            xAxisFormatter,
            totalMark,
          }),
      },
      series: barSeries,
    };

    return {
      transformedProps: {
        refs,
        formData: rawFormData,
        width,
        height,
        echartOptions,
        onLegendStateChanged,
      },
    };
  },

  render: ({ transformedProps }) => {
    const {
      height,
      width,
      echartOptions,
      refs,
      onLegendStateChanged,
      formData,
    } = transformedProps;

    const eventHandlers: EventHandlers = {
      legendselectchanged: payload => {
        onLegendStateChanged?.(payload.selected);
      },
      legendselectall: payload => {
        onLegendStateChanged?.(payload.selected);
      },
      legendinverseselect: payload => {
        onLegendStateChanged?.(payload.selected);
      },
    };

    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
        vizType={formData.vizType as string}
      />
    );
  },
});
