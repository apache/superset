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
import {
  CurrencyFormatter,
  DataRecord,
  ensureIsArray,
  GenericDataType,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  isAdhocColumn,
  NumberFormatter,
  rgbToHex,
  tooltipHtml,
} from '@superset-ui/core';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption } from 'echarts/charts';
import {
  EchartsWaterfallChartProps,
  ISeriesData,
  WaterfallChartTransformedProps,
  ICallbackDataParams,
} from './types';
import { getDefaultTooltip } from '../utils/tooltip';
import { defaultGrid, defaultYAxis } from '../defaults';
import { ASSIST_MARK, LEGEND, TOKEN, TOTAL_MARK } from './constants';
import { getColtypesMapping } from '../utils/series';
import { Refs } from '../types';
import { NULL_STRING } from '../constants';

type EChartsOption = ComposeOption<BarSeriesOption>;

function formatTooltip({
  params,
  breakdownName,
  defaultFormatter,
  xAxisFormatter,
}: {
  params: ICallbackDataParams[];
  breakdownName?: string;
  defaultFormatter: NumberFormatter | CurrencyFormatter;
  xAxisFormatter: (value: number | string, index: number) => string;
}) {
  const series = params.find(
    param => param.seriesName !== ASSIST_MARK && param.data.value !== TOKEN,
  );

  // We may have no matching series depending on the legend state
  if (!series) {
    return '';
  }

  const isTotal = series?.seriesName === LEGEND.TOTAL;
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
  rows.push([TOTAL_MARK, defaultFormatter(series.data.totalSum)]);
  return tooltipHtml(rows, title);
}

function transformer({
  data,
  xAxis,
  metric,
  breakdown,
}: {
  data: DataRecord[];
  xAxis: string;
  metric: string;
  breakdown?: string;
}) {
  // Group by series (temporary map)
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
      // Calc total per period
      const sum = tempValue.reduce(
        (acc, cur) => acc + ((cur[metric] as number) ?? 0),
        0,
      );
      // Push total per period to the end of period values array
      tempValue.push({
        [xAxis]: key,
        [breakdown]: TOTAL_MARK,
        [metric]: sum,
      });
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
    transformedData.push({
      [xAxis]: TOTAL_MARK,
      [metric]: total,
    });
  }

  return transformedData;
}

export default function transformProps(
  chartProps: EchartsWaterfallChartProps,
): WaterfallChartTransformedProps {
  const {
    width,
    height,
    formData,
    legendState,
    queriesData,
    hooks,
    filterState,
    theme,
    emitCrossFilters,
    inContextMenu,
  } = chartProps;
  const refs: Refs = {};
  let { data = [] } = queriesData[0];

  const { xAxisSortByColumn, xAxisSortByColumnOrder } = formData;
  if (
    xAxisSortByColumn &&
    xAxisSortByColumnOrder &&
    xAxisSortByColumnOrder !== 'NONE'
  ) {
    const sortColumn = xAxisSortByColumn;
    const isAscending = xAxisSortByColumnOrder === 'ASC';

    data = [...data].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return isAscending ? -1 : 1;
      if (bValue == null) return isAscending ? 1 : -1;

      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return isAscending ? aValue - bValue : bValue - aValue;
      }

      // Handle string/other values
      const aStr = String(aValue);
      const bStr = String(bValue);
      const comparison = aStr.localeCompare(bStr);
      return isAscending ? comparison : -comparison;
    });
  }

  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const { setDataMask = () => {}, onContextMenu, onLegendStateChanged } = hooks;
  const {
    currencyFormat,
    granularitySqla = '',
    groupby,
    increaseColor = { r: 90, g: 193, b: 137 },
    decreaseColor = { r: 224, g: 67, b: 85 },
    totalColor = { r: 102, g: 102, b: 102 },
    metric = '',
    xAxis,
    xTicksLayout,
    xAxisTimeFormat,
    showLegend,
    yAxisLabel,
    xAxisLabel,
    yAxisFormat,
    showValue,
    useFirstValueAsSubtotal,
    boldLabels,
    showTotal,
    orientation,
  } = formData;
  const defaultFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({ d3Format: yAxisFormat, currency: currencyFormat })
    : getNumberFormatter(yAxisFormat);

  const seriesformatter = (params: ICallbackDataParams) => {
    const { data } = params;
    const { originalValue } = data;
    return defaultFormatter(originalValue as number);
  };
  const groupbyArray = ensureIsArray(groupby);
  const breakdownColumn = groupbyArray.length ? groupbyArray[0] : undefined;
  const breakdownName = isAdhocColumn(breakdownColumn)
    ? breakdownColumn.label!
    : breakdownColumn;
  const xAxisColumn = xAxis || granularitySqla;
  const xAxisName = isAdhocColumn(xAxisColumn)
    ? xAxisColumn.label!
    : xAxisColumn;
  const metricLabel = getMetricLabel(metric);

  const transformedData = transformer({
    data,
    breakdown: breakdownName,
    xAxis: xAxisName,
    metric: metricLabel,
  });

  const assistData: ISeriesData[] = [];
  const increaseData: ISeriesData[] = [];
  const decreaseData: ISeriesData[] = [];
  const totalData: ISeriesData[] = [];

  let previousTotal = 0;

  transformedData.forEach((datum, index, self) => {
    const totalSum = self.slice(0, index + 1).reduce((prev, cur, i) => {
      if (breakdownName) {
        if (cur[breakdownName] !== TOTAL_MARK || i === 0) {
          return prev + ((cur[metricLabel] as number) ?? 0);
        }
      } else if (cur[xAxisName] !== TOTAL_MARK) {
        return prev + ((cur[metricLabel] as number) ?? 0);
      }
      return prev;
    }, 0);

    const isTotal =
      (breakdownName && datum[breakdownName] === TOTAL_MARK) ||
      datum[xAxisName] === TOTAL_MARK;

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
    if (legendState?.[LEGEND.INCREASE] === false && value > 0) {
      opacity = 0;
    } else if (legendState?.[LEGEND.DECREASE] === false && value < 0) {
      opacity = 0;
    }

    if (isTotal) {
      assistData.push({ value: TOKEN });
    } else if (index === 0) {
      assistData.push({
        value: 0,
      });
    } else if (oppositeSigns || Math.abs(totalSum) > Math.abs(previousTotal)) {
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
    let value = row[xAxisName];
    if (breakdownName && row[breakdownName] !== TOTAL_MARK) {
      column = breakdownName;
      value = row[breakdownName];
    }
    if (!value) {
      value = NULL_STRING;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      value = String(value);
    }
    xAxisColumns.push(column);
    return value;
  });

  const xAxisFormatter = (value: number | string, index: number) => {
    if (value === TOTAL_MARK) {
      return TOTAL_MARK;
    }
    if (coltypeMapping[xAxisColumns[index]] === GenericDataType.Temporal) {
      if (typeof value === 'string') {
        return getTimeFormatter(xAxisTimeFormat)(Number.parseInt(value, 10));
      }
      return getTimeFormatter(xAxisTimeFormat)(value);
    }
    return String(value);
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

  const barSeries: BarSeriesOption[] = [
    {
      ...seriesProps,
      name: ASSIST_MARK,
      data: assistData,
    },
    {
      ...seriesProps,
      name: LEGEND.INCREASE,
      label: {
        show: showValue,
        position: 'top',
        formatter: seriesformatter,
      },
      itemStyle: {
        color: rgbToHex(increaseColor.r, increaseColor.g, increaseColor.b),
      },
      data: increaseData,
    },
    {
      ...seriesProps,
      name: LEGEND.DECREASE,
      label: {
        show: showValue,
        position: 'bottom',
        formatter: seriesformatter,
      },
      itemStyle: {
        color: rgbToHex(decreaseColor.r, decreaseColor.g, decreaseColor.b),
      },
      data: decreaseData,
    },
    {
      ...seriesProps,
      name: LEGEND.TOTAL,
      label: {
        show: showValue,
        position: 'top',
        formatter: seriesformatter,
      },
      itemStyle: {
        color: rgbToHex(totalColor.r, totalColor.g, totalColor.b),
      },
      data: totalData,
    },
  ];

  const baseEchartOptions: EChartsOption = {
    grid: {
      ...defaultGrid,
      top: theme.gridUnit * 7,
      bottom: theme.gridUnit * 7,
      left: theme.gridUnit * 5,
      right: theme.gridUnit * 7,
    },
    legend: {
      show: showLegend,
      selected: legendState,
      data: [LEGEND.INCREASE, LEGEND.DECREASE, LEGEND.TOTAL],
    },
    xAxis: {
      data: xAxisData,
      type: 'category',
      name: xAxisLabel,
      nameTextStyle: {
        padding: [theme.gridUnit * 4, 0, 0, 0],
      },
      nameLocation: 'middle',
      axisLabel,
    },
    yAxis: {
      ...defaultYAxis,
      type: 'value',
      nameTextStyle: {
        padding: [0, 0, theme.gridUnit * 5, 0],
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
      formatter: (params: any) =>
        formatTooltip({
          params,
          breakdownName,
          defaultFormatter,
          xAxisFormatter,
        }),
    },
    series: barSeries,
  };

  const processSeriesData = (options: EChartsOption) => {
    let processedOptions = { ...options };

    // Handle subtotal styling
    if (useFirstValueAsSubtotal) {
      const processedSeries = ((options.series as any[]) || []).map(series => {
        const newData = series.data.map((dataPoint: any, index: number) => {
          if (index !== 0) return dataPoint;
          if (dataPoint?.itemStyle?.color === 'transparent') return dataPoint;
          if (dataPoint.value === '-') return dataPoint;

          const updatedColor = `rgba(${totalColor.r}, ${totalColor.g}, ${totalColor.b})`;
          return {
            ...dataPoint,
            itemStyle: {
              ...dataPoint.itemStyle,
              color: updatedColor,
              borderColor: updatedColor,
            },
          };
        });

        return {
          ...series,
          data: newData,
        };
      });

      processedOptions = {
        ...processedOptions,
        series: processedSeries,
      };
    }

    // Handle total visibility
    if (!showTotal) {
      const totalsIndex =
        ((processedOptions.series as any[]) || [])
          .find(series => series.name === 'Total')
          ?.data.map((dataPoint: any, index: number) =>
            dataPoint.value !== '-' ? index : -1,
          )
          .filter((index: number) => index !== -1) || [];

      const filteredData = [
        ...((processedOptions.xAxis as { data: (string | number)[] }).data ||
          []),
      ].filter((_, index) => !totalsIndex.includes(index));

      const filteredSeries = ((processedOptions.series as any[]) || []).map(
        series => ({
          ...series,
          data: series.data.filter(
            (_: any, index: number) => !totalsIndex.includes(index),
          ),
        }),
      );

      processedOptions = {
        ...processedOptions,
        xAxis: {
          ...(processedOptions.xAxis as any),
          data: filteredData,
        },
        series: filteredSeries,
      };
    }

    // Handle orientation
    if (orientation === 'horizontal') {
      processedOptions = {
        ...processedOptions,
        xAxis: {
          ...((processedOptions.yAxis as any) || {}),
          type: 'value',
        },
        yAxis: {
          ...((processedOptions.xAxis as any) || {}),
          type: 'category',
          data: [...(processedOptions.xAxis as any).data].reverse(),
        },
        series: Array.isArray(processedOptions.series)
          ? processedOptions.series.map((series: any) => ({
              ...series,
              encode: {
                x: series.encode?.y,
                y: series.encode?.x,
              },
              data: [...series.data].reverse(),
              label: {
                ...(series.label || {}),
                position: series.name === 'Decrease' ? 'left' : 'right',
              },
            }))
          : [],
      };
    }

    return processedOptions;
  };

  // adds more formatting to previous axisLabel.formatter
  const getFormattedAxisOptions = (options: EChartsOption) => {
    // If no formatting needed, return original options
    if (boldLabels === 'none' && xTicksLayout !== 'flat') {
      return options;
    }

    // Get total indices for bold formatting
    const totalsIndex = ['total', 'both'].includes(boldLabels)
      ? ((options.series as any[]) || [])
          .find(series => series.name === 'Total')
          ?.data.map((dataPoint: any, index: number) =>
            dataPoint.value !== '-' ? index : -1,
          )
          .filter((index: number) => index !== -1) || []
      : [];

    const formatText = (value: string, index: number) => {
      // Handle bold formatting first
      let formattedValue = value;
      if (value === TOTAL_MARK) {
        formattedValue = TOTAL_MARK;
      } else if (
        coltypeMapping[xAxisColumns[index]] === GenericDataType.Temporal
      ) {
        if (typeof value === 'string') {
          formattedValue = getTimeFormatter(xAxisTimeFormat)(
            Number.parseInt(value, 10),
          );
        } else {
          formattedValue = getTimeFormatter(xAxisTimeFormat)(value);
        }
      } else {
        formattedValue = String(value);
      }

      if (orientation === 'vertical') {
        if (index === 0 && ['subtotal', 'both'].includes(boldLabels)) {
          formattedValue = `{subtotal|${formattedValue}}`;
        } else if (
          totalsIndex.includes(index) &&
          ['total', 'both'].includes(boldLabels)
        ) {
          formattedValue = `{total|${formattedValue}}`;
        }
      } else {
        const axisData = (options.yAxis as { data?: any[] })?.data || [];
        const isLast = index === axisData.length - 1;
        if (isLast && ['subtotal', 'both'].includes(boldLabels)) {
          formattedValue = `{subtotal|${formattedValue}}`;
        } else if (
          totalsIndex.includes(index) &&
          ['total', 'both'].includes(boldLabels)
        ) {
          formattedValue = `{total|${formattedValue}}`;
        }
      }

      return formattedValue;
    };

    const richTextOptions = {
      subtotal: ['subtotal', 'both'].includes(boldLabels)
        ? { fontWeight: 'bold' }
        : undefined,
      total: ['total', 'both'].includes(boldLabels)
        ? { fontWeight: 'bold' }
        : undefined,
    };

    if (orientation === 'vertical') {
      return {
        ...options,
        xAxis: {
          ...(options.xAxis as any),
          axisLabel: {
            ...(options.xAxis as any)?.axisLabel,
            formatter: formatText,
            overflow: 'break',
            interval: 0,
            width: 70,
            rich: {
              ...(options.xAxis as any)?.axisLabel?.rich,
              ...richTextOptions,
            },
          },
        },
      };
    }

    return {
      ...options,
      yAxis: {
        ...(options.yAxis as any),
        axisLabel: {
          ...(options.yAxis as any)?.axisLabel,
          formatter: formatText,
          overflow: 'break',
          rich: {
            ...(options.yAxis as any)?.axisLabel?.rich,
            ...richTextOptions,
          },
        },
      },
    };
  };

  const processedSeriesData = processSeriesData(baseEchartOptions);
  const echartOptions = getFormattedAxisOptions(processedSeriesData);

  const handleCrossFilter = (value: string, isCurrentValue: boolean) => {
    if (value === 'Total') return null;

    if (isCurrentValue) {
      return {
        extraFormData: {},
        filterState: {
          value: null,
        },
      };
    }

    return {
      extraFormData: {
        filters: [
          {
            col: xAxis,
            op: '==',
            val: value,
          },
        ],
      },
      filterState: {
        value,
      },
    };
  };

  const getCrossFilteredSeries = (
    series: any[],
    filterValue: string | null,
  ) => {
    if (!filterValue) {
      return series.map(s => ({
        ...s,
        itemStyle: {
          ...s.itemStyle,
          opacity: 1,
        },
      }));
    }

    const xAxisLabel = baseEchartOptions.xAxis as { data: (string | number)[] };
    const valueIndex = (xAxisLabel?.data || []).indexOf(filterValue);

    return series.map(s => ({
      ...s,
      data: s.data.map((d: any, idx: number) => ({
        ...d,
        itemStyle: {
          ...d.itemStyle,
          opacity: !Number.isNaN(d.value) && idx === valueIndex ? 1 : 0.3,
        },
      })),
    }));
  };

  const crossFilteredSeries = getCrossFilteredSeries(
    baseEchartOptions.series as any[],
    filterState?.value || null,
  );

  const finalEchartOptions = {
    ...echartOptions,
    series:
      orientation === 'horizontal'
        ? crossFilteredSeries.map(s => ({
            ...s,
            data: [...s.data].reverse(),
          }))
        : crossFilteredSeries,
  };

  return {
    refs,
    formData,
    width,
    height,
    echartOptions: finalEchartOptions,
    setDataMask,
    onContextMenu,
    onLegendStateChanged,
    filterState,
    emitCrossFilters,
    handleCrossFilter,
  };
}
