// DODO was here
import type { EChartsCoreOption } from 'echarts/core';
import type { ScatterSeriesOption } from 'echarts/charts';
import { extent } from 'd3-array';
import {
  CategoricalColorNamespace,
  getNumberFormatter,
  AxisType,
  getMetricLabel,
  NumberFormatter,
  tooltipHtml,
  // DODO added start 45525377
  Metric,
  Locale,
  isSavedMetric,
  extractTimegrain,
  QueryFormData,
  TimeFormatter,
  // DODO added stop 45525377
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
import { getDateFormatter } from '../utils/getDateFormatter'; // DODO added 45525377

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

// DODO added 45525377
const getTooltipLabel = (
  metric: any,
  metrics: Metric[],
  defaultLabel: string,
  locale: Locale = 'en',
): string => {
  const upperCasedLocale = locale.toUpperCase();
  if (isSavedMetric(metric)) {
    const foundMetric = metrics.find(item => item.metric_name === metric);
    if (foundMetric) {
      const key = `verbose_name_${locale}` as
        | 'verbose_name_en'
        | 'verbose_name_ru';
      const label = foundMetric[key] ?? foundMetric.verbose_name;
      if (label) return label as string;
    }
  } else {
    const key = `label${upperCasedLocale}`;
    const label = metric?.[key] ?? metric?.label;
    if (label) return label;
  }

  return defaultLabel;
};

export function formatTooltip(
  params: any,
  xAxisLabel: string,
  yAxisLabel: string,
  sizeLabel: string,
  xAxisFormatter: NumberFormatter | TimeFormatter, // DODO changed 45525377
  yAxisFormatter: NumberFormatter | TimeFormatter, // DODO changed 45525377
  tooltipSizeFormatter: NumberFormatter,
) {
  const title = params.data[4]
    ? `${params.data[4]} (${params.data[3]})`
    : params.data[3];

  return tooltipHtml(
    [
      [xAxisLabel, xAxisFormatter(params.data[0])],
      [yAxisLabel, yAxisFormatter(params.data[1])],
      [sizeLabel, tooltipSizeFormatter(params.data[2])],
    ],
    title,
  );
}

export default function transformProps(chartProps: EchartsBubbleChartProps) {
  const {
    height,
    width,
    hooks,
    datasource: { metrics }, // DODO added 45525377
    queriesData,
    formData,
    rawFormData, // DODO added 45525377
    inContextMenu,
    theme,
    // @ts-ignore
    locale, // DODO added 45525377
  } = chartProps;

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
    sliceId,
    // DODO added start 45525377
    xForceTimestampFormatting,
    yForceTimestampFormatting,
    xTimeFormat,
    yTimeFormat, // DODO added stop 45525377
  }: EchartsBubbleFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const legends = new Set<string>();
  const series: ScatterSeriesOption[] = [];

  const xAxisLabel: string = getMetricLabel(x);
  const yAxisLabel: string = getMetricLabel(y);
  const sizeLabel: string = getMetricLabel(size);

  // DODO added start 45525377
  const xAxisTooltipLabel: string = getTooltipLabel(x, metrics, 'x', locale);
  const yAxisTooltipLabel: string = getTooltipLabel(y, metrics, 'y', locale);
  const sizeTooltipLabel: string = getTooltipLabel(
    size,
    metrics,
    'size',
    locale,
  );
  // DODO added stop 45525377

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
      itemStyle: {
        color: colorFn(name, sliceId),
        opacity,
      },
    });
    legends.add(name);
  });

  normalizeSymbolSize(series, maxBubbleSize);

  // DODO added start 45525377
  let xMetricEntry: Metric | undefined;
  let yMetricEntry: Metric | undefined;
  if (metrics) {
    xMetricEntry = chartProps.datasource.metrics.find(
      metricItem => metricItem.metric_name === x,
    );
    yMetricEntry = chartProps.datasource.metrics.find(
      metricItem => metricItem.metric_name === y,
    );
  }
  const granularity = extractTimegrain(rawFormData as QueryFormData);
  const xTimeFormatter = getDateFormatter(
    xTimeFormat,
    granularity,
    xMetricEntry?.d3format,
  );
  const yTimeFormatter = getDateFormatter(
    yTimeFormat,
    granularity,
    yMetricEntry?.d3format,
  );
  // DODO added stop 45525377

  // DODO changed 45525377
  const xAxisFormatter = xForceTimestampFormatting
    ? xTimeFormatter
    : getNumberFormatter(xAxisFormat);
  // DODO changed 45525377
  const yAxisFormatter = yForceTimestampFormatting
    ? yTimeFormatter
    : getNumberFormatter(yAxisFormat);
  const tooltipSizeFormatter = getNumberFormatter(tooltipSizeFormat);

  const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
  const [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);

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

  const xAxisType = logXAxis ? AxisType.Log : AxisType.Value;
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
      type: logYAxis ? AxisType.Log : AxisType.Value,
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
          xAxisTooltipLabel, // DODO changed 45525377
          yAxisTooltipLabel, // DODO changed 45525377
          sizeTooltipLabel, // DODO changed 45525377
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
