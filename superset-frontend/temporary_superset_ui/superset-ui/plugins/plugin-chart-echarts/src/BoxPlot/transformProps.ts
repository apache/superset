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
  QueryFormDataMetric,
} from '@superset-ui/core';
import { BoxPlotQueryFormData } from './types';
import { EchartsProps } from '../types';
import { extractGroupbyLabel } from '../utils/series';

export default function transformProps(chartProps: ChartProps): EchartsProps {
  const { width, height, formData, queryData } = chartProps;
  const data: DataRecord[] = queryData.data || [];
  const {
    colorScheme,
    groupby = [],
    metrics: formDataMetrics,
    numberFormat,
    xTicksLayout,
  } = formData as BoxPlotQueryFormData;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getNumberFormatter(numberFormat);

  // TODO: remove cast once metrics is cleaned up in QueryFormData
  const metrics = (formDataMetrics as QueryFormDataMetric[]).map(
    metric => convertMetric(metric).label,
  );

  const transformedData = data
    .map(datum => {
      return metrics.map(metric => {
        const groupbyLabel = extractGroupbyLabel({ datum, groupby });
        const name = metrics.length === 1 ? groupbyLabel : `${groupbyLabel}, ${metric}`;
        return {
          name,
          value: [
            datum[`${metric}__low`],
            datum[`${metric}__q1`],
            datum[`${metric}__median`],
            datum[`${metric}__q3`],
            datum[`${metric}__high`],
            datum[`${metric}__mean`],
            datum[`${metric}__count`],
            datum[`${metric}__outliers`],
          ],
          itemStyle: {
            color: colorFn(groupbyLabel),
            opacity: 0.6,
            borderColor: colorFn(groupbyLabel),
          },
        };
      });
    })
    .flatMap(row => row);

  const outlierData = data
    .map(datum => {
      return metrics.map(metric => {
        const groupbyLabel = extractGroupbyLabel({ datum, groupby });
        const name = metrics.length === 1 ? groupbyLabel : `${groupbyLabel}, ${metric}`;
        // Outlier data is a nested array of numbers (uncommon, therefore no need to add to DataRecordValue)
        const outlierDatum = (datum[`${metric}__outliers`] || []) as number[];
        return {
          name: 'outlier',
          type: 'scatter',
          data: outlierDatum.map(val => [name, val]),
          tooltip: {
            formatter: (param: { data: [string, number] }) => {
              const headline = `<p><strong>${param.data[0]}</strong></p>`;
              const stats = `${numberFormatter(param.data[1])}`;
              return headline + stats;
            },
          },
          itemStyle: {
            color: colorFn(groupbyLabel),
          },
        };
      });
    })
    .flat(2);

  let axisLabel;
  if (xTicksLayout === '45°') axisLabel = { rotate: -45 };
  else if (xTicksLayout === '90°') axisLabel = { rotate: -90 };
  else if (xTicksLayout === 'flat') axisLabel = { rotate: 0 };
  else if (xTicksLayout === 'staggered') axisLabel = { rotate: -45 };
  else axisLabel = { show: true };

  // @ts-ignore
  const echartOptions: echarts.EChartOption<echarts.EChartOption.SeriesBoxplot> = {
    grid: {
      top: 30,
      bottom: 30,
      left: 20,
      right: 20,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: transformedData.map(row => row.name),
      axisLabel,
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: numberFormatter },
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      axisPointer: {
        type: 'shadow',
      },
    },
    series: [
      {
        name: 'boxplot',
        type: 'boxplot',
        avoidLabelOverlap: true,
        // @ts-ignore
        data: transformedData,
        tooltip: {
          formatter: param => {
            // @ts-ignore
            const {
              value,
              name,
            }: {
              value: [number, number, number, number, number, number, number, number, number[]];
              name: string;
            } = param;
            const headline = `<p><strong>${name}</strong></p>`;
            const stats = [
              `upper: ${numberFormatter(value[5])}`,
              `Q3: ${numberFormatter(value[4])}`,
              `mean: ${numberFormatter(value[6])}`,
              `median: ${numberFormatter(value[3])}`,
              `Q1: ${numberFormatter(value[2])}`,
              `lower: ${numberFormatter(value[1])}`,
              `observations: ${numberFormatter(value[7])}`,
            ];
            if (value[8].length > 0) {
              stats.push(`outliers: ${numberFormatter(value[8].length)}`);
            }
            return headline + stats.join('<br/>');
          },
        },
      },
      // @ts-ignore
      ...outlierData,
    ],
  };

  return {
    width,
    height,
    echartOptions,
  };
}
