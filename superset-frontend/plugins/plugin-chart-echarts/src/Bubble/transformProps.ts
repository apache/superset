import { EChartsCoreOption, ScatterSeriesOption } from 'echarts';
import { EchartsBubbleChartProps, EchartsBubbleFormData } from './types';
import { extent } from 'd3-array';
import {
  CategoricalColorNamespace,
  getNumberFormatter,
} from '@superset-ui/core';
import { DEFAULT_FORM_DATA, MINIMUM_BUBBLE_SIZE } from './constants';
import { defaultGrid, defaultTooltip } from '../defaults';
import { getLegendProps } from '../utils/series';
import { LegendOrientation, LegendType } from '../types';
import { parseYAxisBound } from '../utils/controls';
import { AxisType } from '../Timeseries/types';

function normalizeSymbolSize(
  nodes: ScatterSeriesOption[],
  maxBubbleValue: number,
) {
  const [bubbleMinValue, bubbleMaxValue] = extent(nodes, x => x.data![0][2]);
  const nodeSpread = bubbleMaxValue - bubbleMinValue;
  nodes.forEach(node => {
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
) {
  const title = params.data[4]
    ? `${params.data[3]} <sub>(${params.data[4]})</sub>`
    : params.data[3];

  return `<p>${title}</p>
        ${xAxisLabel}: ${params.data[0]} <br/>
        ${yAxisLabel}: ${params.data[1]} <br/>
        ${sizeLabel}: ${params.data[2]}`;
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
    xAxisTitle: bubbleXAxisTitle,
    yAxisTitle: bubbleYAxisTitle,
    xAxisFormat,
    yAxisFormat,
    yAxisBounds,
    logXAxis,
    logYAxis,
    xAxisTitleMargin,
    yAxisTitleMargin,
    truncateYAxis,
  }: EchartsBubbleFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const legends: string[] = [];
  const series: ScatterSeriesOption[] = [];

  const xAxisLabel: string = x.label || x;
  const yAxisLabel: string = y.label || y;
  const sizeLabel: string = size.label || size;

  data.forEach(datum => {
    const name = (bubbleSeries ? datum[bubbleSeries] : datum[entity]) as string;
    const bubbleSeriesValue = bubbleSeries ? datum[bubbleSeries] : null;

    series.push({
      name,
      data: [
        [
          datum[xAxisLabel] as string,
          datum[yAxisLabel] as string,
          datum[size.label] as string,
          datum[entity] as string,
          bubbleSeriesValue as any,
        ],
      ],
      type: 'scatter',
      itemStyle: { color: colorFn(name) },
    });
    legends.push(name);
  });

  normalizeSymbolSize(series, maxBubbleSize);

  const xAxisFormatter = getNumberFormatter(xAxisFormat);
  const yAxisFormatter = getNumberFormatter(yAxisFormat);

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
      ...defaultTooltip,
      formatter: (params: any): string =>
        formatBubbleLabel(params, xAxisLabel, yAxisLabel, sizeLabel),
    },
    grid: { ...defaultGrid },
  };

  const { onContextMenu } = hooks;

  return {
    height,
    width,
    echartOptions: echartOptions,
    onContextMenu,
    formData,
  };
}
