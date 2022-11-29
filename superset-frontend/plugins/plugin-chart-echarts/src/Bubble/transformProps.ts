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
import { EChartsCoreOption, ScatterSeriesOption } from 'echarts';
import { extent } from 'd3-array';
import {
  CategoricalColorNamespace,
  getNumberFormatter,
  AxisType,
  getMetricLabel,
  NumberFormatter,
} from '@superset-ui/core';
import { EchartsBubbleChartProps, EchartsBubbleFormData } from './types';
import { DEFAULT_FORM_DATA, MINIMUM_BUBBLE_SIZE } from './constants';
import { defaultGrid } from '../defaults';
import { getLegendProps } from '../utils/series';
import { LegendOrientation, LegendType, Refs } from '../types';
import { parseYAxisBound } from '../utils/controls';
import { getDefaultTooltip } from '../utils/tooltip';

function normalizeSymbolSize(
  nodes: ScatterSeriesOption[],
  maxBubbleValue: number,
) {
  const [bubbleMinValue, bubbleMaxValue] = extent(nodes, x => x.data![0][2]);
  const nodeSpread = bubbleMaxValue - bubbleMinValue;
  nodes.forEach(node => {
    // eslint-disable-next-line no-param-reassign
    node.symbolSize =
      (((node.data![0][2] - bubbleMinValue) / nodeSpread) *
        (maxBubbleValue * 2) || 0) + MINIMUM_BUBBLE_SIZE;
  });
}

export function formatBubbleLabel(
  params: any,
  xAxisLabel: string,
  yAxisLabel: string,
  sizeLabel: string,
  tooltipFormatter: NumberFormatter,
) {
  const title = params.data[4]
    ? `${params.data[3]} <sub>(${params.data[4]})</sub>`
    : params.data[3];

  return `<p>${title}</p>
        ${xAxisLabel}: ${tooltipFormatter(params.data[0])} <br/>
        ${yAxisLabel}: ${tooltipFormatter(params.data[1])} <br/>
        ${sizeLabel}: ${tooltipFormatter(params.data[2])}`;
}

export default function transformProps(chartProps: EchartsBubbleChartProps) {
  const { height, width, hooks, queriesData, formData, inContextMenu } =
    chartProps;

  const { data = [] } = queriesData[0];
  const {
    x,
    y,
    size,
    entity,
    maxBubbleSize,
    colorScheme,
    series: bubbleSeries,
    xAxisLabel: bubbleXAxisTitle,
    yAxisLabel: bubbleYAxisTitle,
    xAxisFormat,
    yAxisFormat,
    yAxisBounds,
    logXAxis,
    logYAxis,
    xAxisTitleMargin,
    yAxisTitleMargin,
    truncateYAxis,
    xAxisLabelRotation,
    yAxisLabelRotation,
    tooltipFormat,
    opacity,
  }: EchartsBubbleFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const legends: string[] = [];
  const series: ScatterSeriesOption[] = [];

  const xAxisLabel: string = getMetricLabel(x);
  const yAxisLabel: string = getMetricLabel(y);
  const sizeLabel: string = getMetricLabel(size);

  const refs: Refs = {};

  data.forEach(datum => {
    const name = (bubbleSeries ? datum[bubbleSeries] : datum[entity]) as string;
    const bubbleSeriesValue = bubbleSeries ? datum[bubbleSeries] : null;

    series.push({
      name,
      data: [
        [
          datum[xAxisLabel],
          datum[yAxisLabel],
          datum[sizeLabel],
          datum[entity],
          bubbleSeriesValue as any,
        ],
      ],
      type: 'scatter',
      itemStyle: { color: colorFn(name), opacity },
    });
    legends.push(name);
  });

  normalizeSymbolSize(series, maxBubbleSize);

  const xAxisFormatter = getNumberFormatter(xAxisFormat);
  const yAxisFormatter = getNumberFormatter(yAxisFormat);
  const tooltipFormatter = getNumberFormatter(tooltipFormat);

  const [min, max] = yAxisBounds.map(parseYAxisBound);

  const echartOptions: EChartsCoreOption = {
    series,
    xAxis: {
      axisLabel: { formatter: xAxisFormatter },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      nameRotate: xAxisLabelRotation,
      scale: true,
      name: bubbleXAxisTitle,
      nameLocation: 'middle',
      nameTextStyle: {
        fontWight: 'bolder',
      },
      nameGap: xAxisTitleMargin || 30,
      type: logXAxis ? AxisType.log : AxisType.value,
    },
    yAxis: {
      axisLabel: { formatter: yAxisFormatter },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      nameRotate: yAxisLabelRotation,
      scale: truncateYAxis,
      name: bubbleYAxisTitle,
      nameLocation: 'middle',
      nameTextStyle: {
        fontWight: 'bolder',
      },
      nameGap: yAxisTitleMargin || 50,
      min,
      max,
      type: logYAxis ? AxisType.log : AxisType.value,
    },
    legend: {
      ...getLegendProps(LegendType.Scroll, LegendOrientation.Top, true),
      data: legends,
    },
    tooltip: {
      show: !inContextMenu,
      ...getDefaultTooltip(refs),
      formatter: (params: any): string =>
        formatBubbleLabel(
          params,
          xAxisLabel,
          yAxisLabel,
          sizeLabel,
          tooltipFormatter,
        ),
    },
    grid: { ...defaultGrid },
  };

  const { onContextMenu, setDataMask = () => {} } = hooks;

  return {
    height,
    width,
    echartOptions,
    onContextMenu,
    setDataMask,
    formData,
  };
}
