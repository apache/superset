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
  CategoricalColorNamespace,
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  NumberFormatter,
  SupersetTheme,
} from '@superset-ui/core';
import { EChartsOption, BarSeriesOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  EchartsWaterfallFormData,
  EchartsWaterfallChartProps,
  ISeriesData,
  WaterfallChartTransformedProps,
} from './types';
import { getDefaultTooltip } from '../utils/tooltip';
import { defaultGrid, defaultYAxis } from '../defaults';
import { ASSIST_MARK, LEGEND, TOKEN, TOTAL_MARK } from './constants';
import { extractGroupbyLabel, getColtypesMapping } from '../utils/series';
import { Refs } from '../types';

function formatTooltip({
  theme,
  params,
  numberFormatter,
  richTooltip,
}: {
  theme: SupersetTheme;
  params: any;
  numberFormatter: NumberFormatter;
  richTooltip: boolean;
}) {
  const htmlMaker = (params: any) =>
    `
    <div>${params.name}</div>
    <div>
      ${params.marker}
      <span style="
        font-size:${theme.typography.sizes.m}px;
        color:${theme.colors.grayscale.base};
        font-weight:${theme.typography.weights.normal};
        margin-left:${theme.gridUnit * 0.5}px;"
      >
        ${params.seriesName}:
      </span>
      <span style="
        float:right;
        margin-left:${theme.gridUnit * 5}px;
        font-size:${theme.typography.sizes.m}px;
        color:${theme.colors.grayscale.base};
        font-weight:${theme.typography.weights.bold}"
      >
        ${numberFormatter(params.data)}
      </span>
    </div>
  `;

  if (richTooltip) {
    const [, increaseParams, decreaseParams, totalParams] = params;
    if (increaseParams.data !== TOKEN || increaseParams.data === null) {
      return htmlMaker(increaseParams);
    }
    if (decreaseParams.data !== TOKEN) {
      return htmlMaker(decreaseParams);
    }
    if (totalParams.data !== TOKEN) {
      return htmlMaker(totalParams);
    }
  } else if (params.seriesName !== ASSIST_MARK) {
    return htmlMaker(params);
  }
  return '';
}

function transformer({
  data,
  breakdown,
  series,
  metric,
}: {
  data: DataRecord[];
  breakdown: string;
  series: string;
  metric: string;
}) {
  // Group by series (temporary map)
  const groupedData = data.reduce((acc, cur) => {
    const categoryLabel = cur[series] as string;
    const categoryData = acc.get(categoryLabel) || [];
    categoryData.push(cur);
    acc.set(categoryLabel, categoryData);
    return acc;
  }, new Map<string, DataRecord[]>());

  const transformedData: DataRecord[] = [];

  if (breakdown?.length) {
    groupedData.forEach((value, key) => {
      const tempValue = value;
      // Calc total per period
      const sum = tempValue.reduce(
        (acc, cur) => acc + ((cur[metric] as number) ?? 0),
        0,
      );
      // Push total per period to the end of period values array
      tempValue.push({
        [series]: key,
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
        [series]: key,
        [metric]: sum,
      });
      total += sum;
    });
    transformedData.push({
      [series]: TOTAL_MARK,
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
    queriesData,
    hooks,
    filterState,
    theme,
    inContextMenu,
  } = chartProps;
  const refs: Refs = {};
  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const { setDataMask = () => {}, onContextMenu } = hooks;
  const {
    colorScheme,
    metric = '',
    columns,
    series,
    xTicksLayout,
    showLegend,
    yAxisLabel,
    xAxisLabel,
    yAxisFormat,
    richTooltip,
    showValue,
    sliceId,
  } = formData as EchartsWaterfallFormData;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getNumberFormatter(yAxisFormat);
  const formatter = (params: CallbackDataParams) => {
    const { value, seriesName } = params;
    let formattedValue = numberFormatter(value as number);
    if (seriesName === LEGEND.DECREASE) {
      formattedValue = `-${formattedValue}`;
    }
    return formattedValue;
  };
  const breakdown = columns?.length ? columns : '';
  const groupby = breakdown ? [series, breakdown] : [series];
  const metricLabel = getMetricLabel(metric);
  const columnLabels = groupby.map(getColumnLabel);
  const columnsLabelMap = new Map<string, string[]>();

  const transformedData = transformer({
    data,
    breakdown,
    series,
    metric: metricLabel,
  });

  const assistData: ISeriesData[] = [];
  const increaseData: ISeriesData[] = [];
  const decreaseData: ISeriesData[] = [];
  const totalData: ISeriesData[] = [];

  transformedData.forEach((datum, index, self) => {
    const totalSum = self.slice(0, index + 1).reduce((prev, cur, i) => {
      if (breakdown?.length) {
        if (cur[breakdown] !== TOTAL_MARK || i === 0) {
          return prev + ((cur[metricLabel] as number) ?? 0);
        }
      } else if (cur[series] !== TOTAL_MARK) {
        return prev + ((cur[metricLabel] as number) ?? 0);
      }
      return prev;
    }, 0);

    const joinedName = extractGroupbyLabel({
      datum,
      groupby: columnLabels,
      coltypeMapping,
    });
    columnsLabelMap.set(
      joinedName,
      columnLabels.map(col => datum[col] as string),
    );
    const value = datum[metricLabel] as number;
    const isNegative = value < 0;
    if (datum[breakdown] === TOTAL_MARK || datum[series] === TOTAL_MARK) {
      increaseData.push(TOKEN);
      decreaseData.push(TOKEN);
      assistData.push(TOKEN);
      totalData.push(totalSum);
    } else if (isNegative) {
      increaseData.push(TOKEN);
      decreaseData.push(Math.abs(value));
      assistData.push(totalSum);
      totalData.push(TOKEN);
    } else {
      increaseData.push(value);
      decreaseData.push(TOKEN);
      assistData.push(totalSum - value);
      totalData.push(TOKEN);
    }
  });

  let axisLabel;
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

  let xAxisData: string[] = [];
  if (breakdown?.length) {
    xAxisData = transformedData.map(row => {
      if (row[breakdown] === TOTAL_MARK) {
        return row[series] as string;
      }
      return row[breakdown] as string;
    });
  } else {
    xAxisData = transformedData.map(row => row[series] as string);
  }

  const barSeries: BarSeriesOption[] = [
    {
      name: ASSIST_MARK,
      type: 'bar',
      stack: 'stack',
      itemStyle: {
        borderColor: 'transparent',
        color: 'transparent',
      },
      emphasis: {
        itemStyle: {
          borderColor: 'transparent',
          color: 'transparent',
        },
      },
      data: assistData,
    },
    {
      name: LEGEND.INCREASE,
      type: 'bar',
      stack: 'stack',
      label: {
        show: showValue,
        position: 'top',
        formatter,
      },
      itemStyle: {
        color: colorFn(LEGEND.INCREASE, sliceId),
      },
      data: increaseData,
    },
    {
      name: LEGEND.DECREASE,
      type: 'bar',
      stack: 'stack',
      label: {
        show: showValue,
        position: 'bottom',
        formatter,
      },
      itemStyle: {
        color: colorFn(LEGEND.DECREASE, sliceId),
      },
      data: decreaseData,
    },
    {
      name: LEGEND.TOTAL,
      type: 'bar',
      stack: 'stack',
      label: {
        show: showValue,
        position: 'top',
        formatter,
      },
      itemStyle: {
        color: colorFn(LEGEND.TOTAL, sliceId),
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
      data: [LEGEND.INCREASE, LEGEND.DECREASE, LEGEND.TOTAL],
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
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
      axisLabel: { formatter: numberFormatter },
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      appendToBody: true,
      trigger: richTooltip ? 'axis' : 'item',
      show: !inContextMenu,
      formatter: (params: any) =>
        formatTooltip({
          theme,
          params,
          numberFormatter,
          richTooltip,
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
    labelMap: Object.fromEntries(columnsLabelMap),
    groupby,
    selectedValues: filterState.selectedValues || [],
    onContextMenu,
  };
}
