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
  getMetricLabel,
  getNumberFormatter,
  NumberFormatter,
  t,
} from '@superset-ui/core';
import { EChartsOption, BarSeriesOption } from 'echarts';
import {
  CallbackDataParams,
  OptionDataValue,
} from 'echarts/types/src/util/types';
import { BarDataItemOption } from 'echarts/types/src/chart/bar/BarSeries';
import { EchartsWaterfallFormData, EchartsWaterfallChartProps } from './types';
import { defaultGrid, defaultTooltip, defaultYAxis } from '../defaults';
import { EchartsProps } from '../types';

const TOTAL_MARK = t('Total');
const ASSIST_MARK = t('assist');

const LEGEND = {
  INCREASE: t('Increase'),
  DECREASE: t('Decrease'),
  TOTAL: t('Total'),
};

function formatTooltip({
  params,
  numberFormatter,
  richTooltip,
}: {
  params: any;
  numberFormatter: NumberFormatter;
  richTooltip: boolean;
}) {
  const htmlMaker = (params: any) =>
    `
    <div>${params.name}</div>
    <div>
      ${params.marker}
      <span style="font-size:14px;color:#666;font-weight:400;margin-left:2px">${
        params.seriesName
      }: </span>
      <span style="float:right;margin-left:20px;font-size:14px;color:#666;font-weight:900">${numberFormatter(
        params.data,
      )}</span>
    </div>
  `;

  if (richTooltip) {
    const [, increaseParams, decreaseParams, totalParams] = params;
    if (increaseParams.data !== '-' || increaseParams.data === null) {
      return htmlMaker(increaseParams);
    }
    if (decreaseParams.data !== '-') {
      return htmlMaker(decreaseParams);
    }
    if (totalParams.data !== '-') {
      return htmlMaker(totalParams);
    }
  } else if (params.seriesName !== ASSIST_MARK) {
    return htmlMaker(params);
  }
  return '';
}

function transformer({
  data,
  columns,
  series,
  metric,
}: {
  data: DataRecord[];
  columns: string;
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

  if (columns?.length) {
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
        [columns]: TOTAL_MARK,
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
): EchartsProps {
  const { width, height, formData, queriesData } = chartProps;
  const { data = [] } = queriesData[0];
  const {
    colorScheme,
    metric = '',
    columns = '',
    series,
    xTicksLayout,
    showLegend,
    yAxisLabel,
    xAxisLabel,
    yAxisFormat,
    richTooltip,
    showValue,
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

  const metricLabel = getMetricLabel(metric);

  const transformedData = transformer({
    data,
    columns,
    series,
    metric: metricLabel,
  });

  const assistData: (
    | BarDataItemOption
    | OptionDataValue
    | OptionDataValue[]
  )[] = [];
  const increaseData: (
    | BarDataItemOption
    | OptionDataValue
    | OptionDataValue[]
  )[] = [];
  const decreaseData: (
    | BarDataItemOption
    | OptionDataValue
    | OptionDataValue[]
  )[] = [];
  const totalData: (BarDataItemOption | OptionDataValue | OptionDataValue[])[] =
    [];

  transformedData.forEach((data, index, self) => {
    const totalSum = self.slice(0, index + 1).reduce((prev, cur, i) => {
      if (columns?.length) {
        if (cur[columns] !== TOTAL_MARK || i === 0) {
          return prev + ((cur[metricLabel] as number) ?? 0);
        }
      } else if (cur[series] !== TOTAL_MARK) {
        return prev + ((cur[metricLabel] as number) ?? 0);
      }
      return prev;
    }, 0);

    const value = data[metricLabel] as number;
    const isNegative = value < 0;
    if (data[columns] === TOTAL_MARK || data[series] === TOTAL_MARK) {
      increaseData.push('-');
      decreaseData.push('-');
      assistData.push('-');
      totalData.push(totalSum);
    } else if (isNegative) {
      increaseData.push('-');
      decreaseData.push(Math.abs(value));
      assistData.push(totalSum);
      totalData.push('-');
    } else {
      increaseData.push(value);
      decreaseData.push('-');
      assistData.push(totalSum - value);
      totalData.push('-');
    }
  });

  let axisLabel;
  if (xTicksLayout === '45°') axisLabel = { rotate: -45 };
  else if (xTicksLayout === '90°') axisLabel = { rotate: -90 };
  else if (xTicksLayout === 'flat') axisLabel = { rotate: 0 };
  else if (xTicksLayout === 'staggered') axisLabel = { rotate: -45 };
  else axisLabel = { show: true };

  let xAxisData: string[] = [];
  if (columns?.length) {
    xAxisData = transformedData.map(row => {
      if (row[columns] === TOTAL_MARK) {
        return row[series] as string;
      }
      return row[columns] as string;
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
        borderColor: 'rgba(0,0,0,0)',
        color: 'rgba(0,0,0,0)',
      },
      emphasis: {
        itemStyle: {
          borderColor: 'rgba(0,0,0,0)',
          color: 'rgba(0,0,0,0)',
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
        color: colorFn(LEGEND.INCREASE),
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
        color: colorFn(LEGEND.DECREASE),
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
        color: colorFn(LEGEND.TOTAL),
      },
      data: totalData,
    },
  ];

  const echartOptions: EChartsOption = {
    grid: {
      ...defaultGrid,
      top: 30,
      bottom: 30,
      left: 20,
      right: 20,
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
        padding: [15, 0, 0, 0],
      },
      nameLocation: 'middle',
      axisLabel,
    },
    yAxis: {
      ...defaultYAxis,
      type: 'value',
      nameTextStyle: {
        padding: [0, 0, 20, 0],
      },
      nameLocation: 'middle',
      name: yAxisLabel,

      axisLabel: { formatter: numberFormatter },
    },
    tooltip: {
      ...defaultTooltip,
      appendToBody: true,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) =>
        formatTooltip({
          params,
          numberFormatter,
          richTooltip,
        }),
    },
    series: barSeries,
  };

  return {
    width,
    height,
    echartOptions,
  };
}
