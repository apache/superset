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
  ChartProps,
  convertMetric,
  DataRecord,
  getNumberFormatter,
  NumberFormats,
  NumberFormatter,
} from '@superset-ui/core';
import { EchartsPieLabelType, PieChartFormData } from './types';
import { EchartsProps } from '../types';
import { extractGroupbyLabel } from '../utils/series';

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function formatPieLabel({
  params,
  pieLabelType,
  numberFormatter,
}: {
  params: echarts.EChartOption.Tooltip.Format;
  pieLabelType: EchartsPieLabelType;
  numberFormatter: NumberFormatter;
}): string {
  const { name = '', value, percent } = params;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);
  if (pieLabelType === 'key') return name;
  if (pieLabelType === 'value') return formattedValue;
  if (pieLabelType === 'percent') return formattedPercent;
  if (pieLabelType === 'key_value') return `${name}: ${formattedValue}`;
  if (pieLabelType === 'key_value_percent')
    return `${name}: ${formattedValue} (${formattedPercent})`;
  if (pieLabelType === 'key_percent') return `${name}: ${formattedPercent}`;
  return name;
}

export default function transformProps(chartProps: ChartProps): EchartsProps {
  const { width, height, formData, queryData } = chartProps;
  const data: DataRecord[] = queryData.data || [];

  const {
    colorScheme,
    donut = false,
    groupby,
    innerRadius = 40,
    labelsOutside = true,
    metric,
    numberFormat,
    outerRadius = 80,
    pieLabelType = 'value',
    showLabels = true,
    showLegend = false,
  } = formData as PieChartFormData;
  const { label: metricLabel } = convertMetric(metric);

  const keys = data.map(datum => extractGroupbyLabel({ datum, groupby }));
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getNumberFormatter(numberFormat);

  const transformedData = data.map(datum => {
    const name = extractGroupbyLabel({ datum, groupby });
    return {
      value: datum[metricLabel],
      name,
      itemStyle: {
        color: colorFn(name),
      },
    };
  });

  const formatter = (params: { name: string; value: number; percent: number }) =>
    formatPieLabel({ params, numberFormatter, pieLabelType });

  const echartOptions: echarts.EChartOption<echarts.EChartOption.SeriesPie> = {
    tooltip: {
      confine: true,
      trigger: 'item',
      formatter: params => {
        return formatPieLabel({
          params: params as echarts.EChartOption.Tooltip.Format,
          numberFormatter,
          pieLabelType: 'key_value_percent',
        });
      },
    },
    legend: showLegend
      ? {
          orient: 'horizontal',
          left: 10,
          data: keys,
        }
      : undefined,
    series: [
      {
        type: 'pie',
        radius: [`${donut ? innerRadius : 0}%`, `${outerRadius}%`],
        avoidLabelOverlap: true,
        labelLine: labelsOutside ? { show: true } : { show: false },
        label: labelsOutside
          ? {
              formatter,
              position: 'outer',
              show: showLabels,
              alignTo: 'none',
              bleedMargin: 5,
            }
          : {
              formatter,
              position: 'inner',
              show: showLabels,
            },
        emphasis: {
          label: {
            show: true,
            fontSize: 30,
            fontWeight: 'bold',
          },
        },
        // @ts-ignore
        data: transformedData,
      },
    ],
  };

  return {
    width,
    height,
    echartOptions,
  };
}
