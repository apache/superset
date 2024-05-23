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
import { BarSeriesOption, EChartsOption } from 'echarts';
import { isEmpty } from 'lodash';
import { CategoricalColorNamespace, getColumnLabel } from '@superset-ui/core';
import { HistogramChartProps, HistogramTransformedProps } from './types';
import { LegendOrientation, LegendType, Refs } from '../types';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getLegendProps } from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';

const TOTAL_SERIES = 'total';

export default function transformProps(
  chartProps: HistogramChartProps,
): HistogramTransformedProps {
  const refs: Refs = {};
  const {
    formData,
    height,
    hooks,
    legendState = {},
    queriesData,
    theme,
    width,
  } = chartProps;
  const { onLegendStateChanged } = hooks;
  const {
    colorScheme,
    column,
    groupby = [],
    showLegend,
    showValue,
    sliceId,
  } = formData;
  const { data } = queriesData[0];
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const xAxisData: string[] = Object.keys(data[0]).filter(
    key => groupby.includes(key) === false,
  );
  const barSeries: BarSeriesOption[] = data.map(datum => {
    const seriesName =
      groupby.length > 0
        ? groupby.map(key => datum[getColumnLabel(key)]).join(', ')
        : getColumnLabel(column);
    const seriesData = Object.keys(datum)
      .filter(key => groupby.includes(key) === false)
      .map(key => datum[key] as number);
    return {
      name: seriesName,
      type: 'bar',
      data: seriesData,
      stack: 'stack',
      itemStyle: {
        color: colorFn(seriesName, sliceId),
      },
    };
  });

  const legendOptions = barSeries.map(series => series.name as string);
  if (isEmpty(legendState)) {
    legendOptions.forEach(legend => {
      legendState[legend] = true;
    });
  }

  if (showValue) {
    barSeries.push({
      name: TOTAL_SERIES,
      type: 'bar',
      stack: 'stack',
      label: {
        show: true,
        position: 'top',
        formatter: params => {
          const { dataIndex } = params;
          // TODO: Format number
          return barSeries
            .filter(series => legendState[series.name!])
            .reduce(
              (acc, series) => acc + (series.data![dataIndex] as number),
              0,
            )
            .toFixed(2);
        },
      },
      data: barSeries[0].data!.map(() => 0),
    });
  }

  const echartOptions: EChartsOption = {
    grid: {
      ...defaultGrid,
      bottom: 0,
      left: 0,
      right: 0,
    },
    xAxis: {
      data: xAxisData,
      type: 'category',
      nameLocation: 'middle',
    },
    yAxis: {
      ...defaultYAxis,
      type: 'value',
      nameLocation: 'middle',
    },
    series: barSeries,
    legend: {
      ...getLegendProps(
        LegendType.Scroll,
        LegendOrientation.Top,
        showLegend,
        theme,
        false,
        legendState,
      ),
      data: legendOptions,
    },
    tooltip: {
      ...getDefaultTooltip(refs),
    },
  };

  return {
    refs,
    formData,
    width,
    height,
    echartOptions,
    onLegendStateChanged,
  };
}
