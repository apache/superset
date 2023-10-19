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
  SupersetTheme,
} from '@superset-ui/core';
import { EChartsOption, BarSeriesOption } from 'echarts';
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

function formatTooltip({
  theme,
  params,
  breakdownName,
  defaultFormatter,
  xAxisFormatter,
}: {
  theme: SupersetTheme;
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

  const createRow = (name: string, value: string) => `
    <div>
      <span style="
        font-size:${theme.typography.sizes.m}px;
        color:${theme.colors.grayscale.base};
        font-weight:${theme.typography.weights.normal};
        margin-left:${theme.gridUnit * 0.5}px;"
      >
        ${name}:
      </span>
      <span style="
        float:right;
        margin-left:${theme.gridUnit * 5}px;
        font-size:${theme.typography.sizes.m}px;
        color:${theme.colors.grayscale.base};
        font-weight:${theme.typography.weights.bold}"
      >
        ${value}
      </span>
    </div>
  `;

  let result = '';
  if (!isTotal || breakdownName) {
    result = xAxisFormatter(series.name, series.dataIndex);
  }
  if (!isTotal) {
    result += createRow(
      series.seriesName!,
      defaultFormatter(series.data.originalValue),
    );
  }
  result += createRow(TOTAL_MARK, defaultFormatter(series.data.totalSum));
  return result;
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
    theme,
    inContextMenu,
  } = chartProps;
  const refs: Refs = {};
  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const { setDataMask = () => {}, onContextMenu, onLegendStateChanged } = hooks;
  const {
    currencyFormat,
    groupby,
    increaseColor,
    decreaseColor,
    totalColor,
    metric = '',
    xAxis,
    xTicksLayout,
    xAxisTimeFormat,
    showLegend,
    yAxisLabel,
    xAxisLabel,
    yAxisFormat,
    showValue,
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
  const xAxisName = isAdhocColumn(xAxis) ? xAxis.label! : xAxis;
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
    if (coltypeMapping[xAxisColumns[index]] === GenericDataType.TEMPORAL) {
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

  const echartOptions: EChartsOption = {
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
          theme,
          params,
          breakdownName,
          defaultFormatter,
          xAxisFormatter,
        }),
    },
    series: barSeries,
  };

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
