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
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getXAxisLabel,
  isPhysicalColumn,
  isDefined,
  getXAxisColumn,
} from '@superset-ui/core';
import type { EChartsCoreOption, CandlestickSeriesOption } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  CandlestickChartTransformedProps,
  EchartsCandlestickChartProps,
} from './types';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getColtypesMapping, sanitizeHtml } from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';

export default function transformProps(
  chartProps: EchartsCandlestickChartProps,
): CandlestickChartTransformedProps {
  const { width, height, formData, queriesData, hooks, filterState } = chartProps;
  const { data = [], verboseMap = {} } = queriesData[0];
  const { setDataMask = () => {}, emitCrossFilters, onContextMenu } = hooks;
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const refs: Refs = {} as Refs;

  const {
    open: openMetric,
    close: closeMetric,
    low: lowMetric,
    high: highMetric,
    zoomable,
  } = formData;

  const openLabel = getMetricLabel(openMetric);
  const closeLabel = getMetricLabel(closeMetric);
  const lowLabel = getMetricLabel(lowMetric);
  const highLabel = getMetricLabel(highMetric);
  
  let xAxisLabel = getXAxisLabel(chartProps.rawFormData) || '__timestamp';
  if (
    isPhysicalColumn(chartProps.rawFormData?.x_axis) &&
    isDefined(verboseMap[xAxisLabel])
  ) {
    xAxisLabel = verboseMap[xAxisLabel];
  }

  const timeFormatter = getTimeFormatter('%Y-%m-%d %H:%M:%S');
  const numberFormatter = getNumberFormatter();

  const transformedData = data
    .map(datum => {
      const time = datum[xAxisLabel];
      const o = datum[openLabel];
      const c = datum[closeLabel];
      const l = datum[lowLabel];
      const h = datum[highLabel];
      
      if (o == null || c == null || l == null || h == null) {
        return null;
      }
      
      return [time, o, c, l, h];
    })
    .filter(Boolean) as [any, number, number, number, number][];

  const series: CandlestickSeriesOption[] = [
    {
      name: 'OHLC',
      type: 'candlestick',
      data: transformedData.map(row => row.slice(1)),
      itemStyle: {
        // International standard: Green for Up, Red for Down
        color: '#14b143', 
        color0: '#ef232a',
        borderColor: '#14b143',
        borderColor0: '#ef232a',
      },
    },
  ];

  const echartOptions: EChartsCoreOption = {
    grid: {
      ...defaultGrid,
      bottom: zoomable ? '15%' : '10%',
    },
    xAxis: {
      type: 'category',
      data: transformedData.map(row => timeFormatter(row[0])),
      scale: true,
      boundaryGap: false,
      axisLine: { onZero: false },
      splitLine: { show: false },
      min: 'dataMin',
      max: 'dataMax',
    },
    yAxis: {
      ...defaultYAxis,
      scale: true,
      splitArea: {
        show: true,
      },
      axisLabel: { formatter: numberFormatter },
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: CallbackDataParams[]) => {
        const p = params[0];
        const [o, c, l, h] = p.value as number[];
        return `
          <div style="padding: 3px;">
            <p style="margin-bottom: 5px;"><strong>${sanitizeHtml(p.name)}</strong></p>
            <div style="display: flex; justify-content: space-between;">
              <span style="margin-right: 10px;">Open:</span>
              <strong>${numberFormatter(o)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="margin-right: 10px;">Close:</span>
              <strong>${numberFormatter(c)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="margin-right: 10px;">Low:</span>
              <strong>${numberFormatter(l)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="margin-right: 10px;">High:</span>
              <strong>${numberFormatter(h)}</strong>
            </div>
          </div>
        `;
      },
    },
    series,
    dataZoom: zoomable
      ? [
          {
            type: 'inside',
            start: 0,
            end: 100,
          },
          {
            show: true,
            type: 'slider',
            top: '90%',
            start: 0,
            end: 100,
          },
        ]
      : [],
  };

  const groupby = [getXAxisColumn(formData)].filter(Boolean) as string[];
  const labelMap = { [xAxisLabel]: [xAxisLabel] };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    refs,
    coltypeMapping,
    selectedValues: filterState?.selectedValues || {},
    groupby,
    labelMap,
    emitCrossFilters,
    onContextMenu,
  };
}
