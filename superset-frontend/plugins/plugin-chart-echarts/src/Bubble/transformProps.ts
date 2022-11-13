import { EChartsCoreOption } from 'echarts';
import { EchartsBubbleChartProps, EchartsBubbleFormData } from './types';
import { extent } from 'd3-array';
import { sanitizeHtml } from '../utils/series';
import { CategoricalColorNamespace } from '@superset-ui/core';

function normalizeSymbolSize(nodes, maxBubbleValue, minBubbleValue = 10) {
  const [bubbleMinValue, bubbleMaxValue] = extent(nodes, x => x.data[0][2]);
  const nodeSpread = bubbleMaxValue - bubbleMinValue;
  nodes.forEach(node => {
    node.symbolSize =
      ((node.data[0][2] - bubbleMinValue) / nodeSpread) * maxBubbleValue +
      minBubbleValue;
  });
}

export default function transformProps(chartProps: EchartsBubbleChartProps) {
  const { height, width, hooks, filterState, queriesData, theme, formData } =
    chartProps;

  const { data = [] } = queriesData[0];
  const {
    x,
    y,
    yAxis,
    size,
    entity,
    maxBubbleSize,
    colorScheme,
    series: bubbleSeries,
  }: EchartsBubbleFormData = formData;

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const legends = [];
  const series = [];

  data.forEach(d => {
    series.push({
      name: bubbleSeries ? d[bubbleSeries] : d[entity],
      data: [[d[x], d[y.label], d[size.label], d[entity], d[bubbleSeries]]],
      type: 'scatter',
      itemStyle: { color: colorFn(d[bubbleSeries] || d[entity]) },
    });
    legends.push(bubbleSeries ? d[bubbleSeries] : d[entity]);
  });

  normalizeSymbolSize(series, maxBubbleSize);

  const echartOptions: EChartsCoreOption = {
    series,
    xAxis: {
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      scale: true,
    },
    yAxis: {
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      scale: true,
    },
    legend: {
      right: '10%',
      top: '3%',
      data: legends,
    },
    tooltip: {
      formatter: (params: any): string => {
        const title = params.data[4]
          ? `${params.data[3]} (${params.data[4]})`
          : params.data[3];
        return `${title} <br/>
                ${x}: ${params.data[0]} <br/>
                ${y.label}: ${params.data[1]} <br/>
                ${size.label}: ${params.data[2]}
                `;
      },
    },
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
