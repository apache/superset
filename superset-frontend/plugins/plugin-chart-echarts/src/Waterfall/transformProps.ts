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
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  isAdhocColumn,
  NumberFormatter,
  rgbToHex,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
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
  totalMark,
  useNonCumulative,
}: {
  params: ICallbackDataParams[];
  breakdownName?: string;
  defaultFormatter: NumberFormatter | CurrencyFormatter;
  xAxisFormatter: (value: number | string, index: number) => string;
  totalMark: string;
  useNonCumulative: boolean;
}) {
  const series = params.find(
    param => param.seriesName !== ASSIST_MARK && param.data.value !== TOKEN,
  );

  if (typeof console !== 'undefined') {
    console.debug('[Waterfall] tooltip raw params', {
      useNonCumulative,
      params,
      pickedSeriesName: series?.seriesName,
      pickedData: series?.data,
    });
  }

  // We may have no matching series depending on the legend state
  if (!series) {
    return '';
  }

  const isTotal = series.seriesName === totalMark;
  if (!series) {
    return NULL_STRING;
  }

  const title =
    !isTotal || breakdownName
      ? xAxisFormatter(series.name, series.dataIndex)
      : undefined;

  const rows: string[][] = [];

  if (useNonCumulative && !isTotal) {
    // Non-cumulative mode: show Start / End / Change (%)
    const d: any = series.data || {};
    const start = d.start;
    const end = d.end ?? d.totalSum;
    const absChange = d.originalValue as number | undefined;

    let percentChange: number | null = null;
    if (
      typeof start === 'number' &&
      start !== 0 &&
      typeof absChange === 'number'
    ) {
      percentChange = (absChange / start) * 100;
    }

    if (typeof console !== 'undefined') {
      console.debug('[Waterfall] tooltip (nonCumulative)', {
        seriesName: series.seriesName,
        start,
        end,
        absChange,
        percentChange,
        totalSum: d.totalSum,
      });
    }

    if (start !== undefined) {
      rows.push(['Start', defaultFormatter(start)]);
    }
    if (end !== undefined) {
      rows.push(['End', defaultFormatter(end)]);
    }

    if (percentChange !== null) {
      rows.push(['Change (%)', `${percentChange.toFixed(2)}%`]);
    } else if (absChange !== undefined) {
      // Fallback to absolute change if we cannot compute percentage (e.g. start = 0)
      rows.push(['Change', defaultFormatter(absChange)]);
    }

    return tooltipHtml(rows, title);
  }

  // Default / cumulative mode behavior
  if (!isTotal) {
    rows.push([
      series.seriesName!,
      defaultFormatter(series.data.originalValue),
    ]);
  }
  rows.push([totalMark, defaultFormatter(series.data.totalSum)]);

  if (typeof console !== 'undefined') {
    console.debug('[Waterfall] tooltip (cumulative/default)', {
      seriesName: series.seriesName,
      isTotal,
      rows,
    });
  }

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
    theme,
    inContextMenu,
  } = chartProps;
  const refs: Refs = {};
  const { data = [] } = queriesData[0] || {};
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
    showTotal,
    totalLabel,
    increaseLabel,
    decreaseLabel,
    // new fields
    nonCumulative,
    metricStart,
    metricEnd,
  } = formData as any;

  if (typeof console !== 'undefined') {
    console.debug('[Waterfall] transformProps called', {
      width,
      height,
      dataLength: data.length,
      nonCumulative,
      metric,
      metricStart,
      metricEnd,
    });
  }

  const defaultFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({ d3Format: yAxisFormat, currency: currencyFormat })
    : getNumberFormatter(yAxisFormat);

  const totalMark = totalLabel || TOTAL_MARK;
  const legendNames = {
    INCREASE: increaseLabel || LEGEND.INCREASE,
    DECREASE: decreaseLabel || LEGEND.DECREASE,
    TOTAL: totalLabel || LEGEND.TOTAL,
  };

  const seriesformatter = (params: ICallbackDataParams) => {
    const d: any = params.data || {};
    const originalValue = d.originalValue as number | undefined;

    if (useNonCumulative) {
      // In non-cumulative mode, show END metric on top of the bar
      const endValue =
        d.end ?? d.totalSum ?? originalValue ?? d.value ?? 0;

      if (typeof console !== 'undefined') {
        console.debug('[Waterfall] label formatter (nonCumulative)', {
          seriesName: params.seriesName,
          originalValue,
          end: d.end,
          totalSum: d.totalSum,
          value: d.value,
          endValue,
        });
      }

      return defaultFormatter(endValue as number);
    }

    // Cumulative / default mode: keep current behavior (show change)
    if (typeof console !== 'undefined') {
      console.debug('[Waterfall] label formatter (cumulative/default)', {
        seriesName: params.seriesName,
        originalValue,
      });
    }

    return defaultFormatter((originalValue as number) ?? 0);
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
  const metricStartLabel = metricStart ? getMetricLabel(metricStart) : undefined;
  const metricEndLabel = metricEnd ? getMetricLabel(metricEnd) : undefined;

  const useNonCumulative = Boolean(
    nonCumulative && metricStartLabel && metricEndLabel,
  );

  if (typeof console !== 'undefined') {
    console.debug('[Waterfall] mode and labels', {
      useNonCumulative,
      nonCumulative,
      metricLabel,
      metricStartLabel,
      metricEndLabel,
      xAxisName,
      breakdownName,
    });
  }

  if (useNonCumulative && data.length > 0) {
    const sample = data[0];
    const startKey = metricStartLabel as string;
    const endKey = metricEndLabel as string;
    const startInSample = startKey in sample;
    const endInSample = endKey in sample;
    if (typeof console !== 'undefined') {
      console.debug('[Waterfall] sample row keys', {
        sampleKeys: Object.keys(sample),
        startKey,
        endKey,
        startInSample,
        endInSample,
      });
      if (!startInSample || !endInSample) {
        console.warn(
          '[Waterfall] nonCumulative enabled but start/end metrics not found in sample row',
          {
            metricStartLabel,
            metricEndLabel,
            availableKeys: Object.keys(sample),
          },
        );
      }
    }
  }

  let transformedData: DataRecord[] = [];

  const assistData: ISeriesData[] = [];
  const increaseData: ISeriesData[] = [];
  const decreaseData: ISeriesData[] = [];
  const totalData: ISeriesData[] = [];

  if (useNonCumulative) {
    // Non-cumulative mode: each bar has independent start/end
    data.forEach((row, idx) => {
      transformedData.push(row);

      const isTotal =
        (breakdownName && row[breakdownName] === totalMark) ||
        row[xAxisName] === totalMark;

      const start = Number(
        metricStartLabel && row[metricStartLabel] != null
          ? row[metricStartLabel]
          : 0,
      );
      const end = Number(
        metricEndLabel && row[metricEndLabel] != null
          ? row[metricEndLabel]
          : 0,
      );
      const delta = end - start;

      if (typeof console !== 'undefined') {
        console.debug('[Waterfall] row (nonCumulative)', {
          index: idx,
          x: row[xAxisName],
          breakdown: breakdownName ? row[breakdownName] : undefined,
          start,
          end,
          delta,
          isTotal,
        });
      }

      if (isTotal) {
        // "Total" bar: stand-alone, from 0 to end
        assistData.push({ value: TOKEN });
        increaseData.push({ value: TOKEN });
        decreaseData.push({ value: TOKEN });
        totalData.push({
          value: end,
          originalValue: end,
          totalSum: end,
          start: 0,
          end,
        } as any);
      } else {
        // Normal bar: base = start, visible = delta
        // Make assist bar transparent so only delta is visible
        assistData.push({
          value: start,
          itemStyle: { color: 'transparent' },
        });

        if (delta >= 0) {
          increaseData.push({
            value: delta,
            originalValue: delta,
            totalSum: end,
            start,
            end,
          } as any);
          decreaseData.push({ value: TOKEN });
        } else {
          // negative delta: show as "decrease"
          increaseData.push({ value: TOKEN });
          decreaseData.push({
            value: -delta,
            originalValue: delta,
            totalSum: end,
            start,
            end,
          } as any);
        }

        // No standalone total series for normal bars
        totalData.push({ value: TOKEN });
      }
    });

    if (typeof console !== 'undefined') {
      console.debug(
        '[Waterfall] nonCumulative series samples',
        {
          assist: assistData.slice(0, 5),
          increase: increaseData.slice(0, 5),
          decrease: decreaseData.slice(0, 5),
          total: totalData.slice(0, 5),
        },
      );
    }
  } else {
    // Original cumulative waterfall behaviour
    const transformed = transformer({
      data,
      breakdown: breakdownName,
      xAxis: xAxisName,
      metric: metricLabel,
      totalMark,
      showTotal,
    });

    transformedData = transformed;

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

    if (typeof console !== 'undefined') {
      console.debug('[Waterfall] cumulative series samples', {
        assist: assistData.slice(0, 5),
        increase: increaseData.slice(0, 5),
        decrease: decreaseData.slice(0, 5),
        total: totalData.slice(0, 5),
      });
    }
  }

  const xAxisColumns: string[] = [];
  const xAxisData = transformedData.map(row => {
    let column = xAxisName;
    let value = row[xAxisName];
    if (breakdownName && row[breakdownName] !== totalMark) {
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
    if (value === totalMark) {
      return totalMark;
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
  const labelProps = {
    show: showValue,
    formatter: seriesformatter,
    color: theme.colorText,
    borderColor: theme.colorBgBase,
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

  const echartOptions: EChartsOption = {
    grid: {
      ...defaultGrid,
      top: theme.sizeUnit * 7,
      bottom: theme.sizeUnit * 7,
      left: theme.sizeUnit * 5,
      right: theme.sizeUnit * 7,
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
        padding: [theme.sizeUnit * 4, 0, 0, 0],
      },
      nameLocation: 'middle',
      axisLabel,
    },
    yAxis: {
      ...defaultYAxis,
      type: 'value',
      nameTextStyle: {
        padding: [0, 0, theme.sizeUnit * 5, 0],
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
          totalMark,
          useNonCumulative,
        }),
    },
    series: barSeries,
  };

  if (typeof console !== 'undefined') {
    console.debug('[Waterfall] final echartOptions.series summary', {
      assistLen: assistData.length,
      increaseLen: increaseData.length,
      decreaseLen: decreaseData.length,
      totalLen: totalData.length,
      xAxisLen: xAxisData.length,
    });
  }

  return {
    refs,
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    onContextMenu,
    onLegendStateChanged,
  };
}
