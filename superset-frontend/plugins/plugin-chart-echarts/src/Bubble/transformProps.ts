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
import { getLegendProps, getMinAndMaxFromBounds } from '../utils/series';
import { Refs } from '../types';
import { parseAxisBound } from '../utils/controls';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPadding } from '../Timeseries/transformers';
import { convertInteger } from '../utils/convertInteger';
import { NULL_STRING } from '../constants';

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

export function formatTooltip(
  params: any,
  xAxisLabel: string,
  yAxisLabel: string,
  sizeLabel: string,
  xAxisFormatter: NumberFormatter,
  yAxisFormatter: NumberFormatter,
  tooltipSizeFormatter: NumberFormatter,
) {
  const title = params.data[4]
    ? `${params.data[3]} </br> ${params.data[4]}`
    : params.data[3];

  return `<p>${title}</p>
        ${xAxisLabel}: ${xAxisFormatter(params.data[0])} <br/>
        ${yAxisLabel}: ${yAxisFormatter(params.data[1])} <br/>
        ${sizeLabel}: ${tooltipSizeFormatter(params.data[2])}`;
}

export default function transformProps(chartProps: EchartsBubbleChartProps) {
  const { height, width, hooks, queriesData, formData, inContextMenu, theme } =
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
    xAxisBounds,
    xAxisFormat,
    yAxisFormat,
    yAxisBounds,
    logXAxis,
    logYAxis,
    xAxisTitleMargin,
    yAxisTitleMargin,
    truncateXAxis,
    truncateYAxis,
    xAxisLabelRotation,
    yAxisLabelRotation,
    tooltipSizeFormat,
    opacity,
    showLegend,
    legendOrientation,
    legendMargin,
    legendType,
  }: EchartsBubbleFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const legends = new Set<string>();
  const series: ScatterSeriesOption[] = [];

  const xAxisLabel: string = getMetricLabel(x);
  const yAxisLabel: string = getMetricLabel(y);
  const sizeLabel: string = getMetricLabel(size);

  const refs: Refs = {};

  data.forEach(datum => {
    const dataName = bubbleSeries ? datum[bubbleSeries] : datum[entity];
    const name = dataName ? String(dataName) : NULL_STRING;
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
    legends.add(name);
  });

  normalizeSymbolSize(series, maxBubbleSize);

  const xAxisFormatter = getNumberFormatter(xAxisFormat);
  const yAxisFormatter = getNumberFormatter(yAxisFormat);
  const tooltipSizeFormatter = getNumberFormatter(tooltipSizeFormat);

  const [xAxisMin, xAxisMax] = xAxisBounds.map(parseAxisBound);
  const [yAxisMin, yAxisMax] = yAxisBounds.map(parseAxisBound);

  const padding = getPadding(
    showLegend,
    legendOrientation,
    true,
    false,
    legendMargin,
    true,
    'Left',
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );

  const xAxisType = logXAxis ? AxisType.log : AxisType.value;
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
      nameGap: convertInteger(xAxisTitleMargin),
      type: xAxisType,
      ...getMinAndMaxFromBounds(xAxisType, truncateXAxis, xAxisMin, xAxisMax),
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
      nameGap: convertInteger(yAxisTitleMargin),
      min: yAxisMin,
      max: yAxisMax,
      type: logYAxis ? AxisType.log : AxisType.value,
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, theme),
      data: Array.from(legends),
    },
    tooltip: {
      show: !inContextMenu,
      ...getDefaultTooltip(refs),
      formatter: (params: any): string =>
        formatTooltip(
          params,
          xAxisLabel,
          yAxisLabel,
          sizeLabel,
          xAxisFormatter,
          yAxisFormatter,
          tooltipSizeFormatter,
        ),
    },
    grid: { ...defaultGrid, ...padding },
  };

  const { onContextMenu, setDataMask = () => {} } = hooks;

  return {
    refs,
    height,
    width,
    echartOptions,
    onContextMenu,
    setDataMask,
    formData,
  };
}
