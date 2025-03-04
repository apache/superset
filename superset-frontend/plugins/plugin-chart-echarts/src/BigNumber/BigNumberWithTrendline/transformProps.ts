// DODO was here
import {
  extractTimegrain,
  getNumberFormatter,
  NumberFormats,
  GenericDataType,
  getMetricLabel,
  getXAxisLabel,
  Metric,
  getValueFormatter,
  t,
  tooltipHtml,
  isSavedMetric, // DODO added 44211769
} from '@superset-ui/core';
import { EChartsCoreOption, graphic } from 'echarts/core';
import { getColorFormattersWithConditionalMessage } from '@superset-ui/chart-controls'; // DODO added 45525377
import {
  BigNumberVizProps,
  BigNumberDatum,
  BigNumberWithTrendlineChartProps,
  TimeSeriesDatum,
} from '../types';
import { parseMetricValue } from '../utils';
import { getDateFormatter } from '../../utils/getDateFormatter'; // DODO added 45525377
import { getDefaultTooltip } from '../../utils/tooltip';
import { Refs } from '../../types';
import { ValueToShowEnum } from '../../DodoExtensions/BigNumber/types'; // DODO added 45525377
import { BigNumberWithTrendLineTransformPropsDodo } from '../../DodoExtensions/BigNumber/BigNumberWithTrendline/transformPropsDodo'; // DODO added 45525377

const formatPercentChange = getNumberFormatter(
  NumberFormats.PERCENT_SIGNED_1_POINT,
);

export default function transformProps(
  chartProps: BigNumberWithTrendlineChartProps,
): BigNumberVizProps {
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    theme,
    hooks,
    inContextMenu,
    datasource: {
      currencyFormats = {},
      columnFormats = {},
      metrics: datasourceMetrics = [], // DODO added 44211769
    },
  } = chartProps;
  const {
    colorPicker,
    compareLag: compareLag_,
    compareSuffix = '',
    timeFormat,
    headerFontSize,
    metric = 'value',
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    yAxisFormat,
    currencyFormat,
    timeRangeFixed,
    // DODO added start 45525377
    valueToShow,
    conditionalFormattingMessage,
    conditionalMessageFontSize,
    alignment,
    // DODO added stop 45525377
  } = formData;
  const granularity = extractTimegrain(rawFormData);
  const {
    data = [],
    colnames = [],
    coltypes = [],
    from_dttm: fromDatetime,
    to_dttm: toDatetime,
  } = queriesData[0];
  const refs: Refs = {};
  const metricName = getMetricLabel(metric);
  const compareLag = Number(compareLag_) || 0;
  let formattedSubheader = subheader;

  const { r, g, b } = colorPicker;
  const mainColor = `rgb(${r}, ${g}, ${b})`;

  const xAxisLabel = getXAxisLabel(rawFormData) as string;
  let trendLineData: TimeSeriesDatum[] | undefined;
  let percentChange = 0;
  let bigNumber = data.length === 0 ? null : data[0][metricName];
  let timestamp = data.length === 0 ? null : data[0][xAxisLabel];
  let bigNumberFallback;

  const metricColtypeIndex = colnames.findIndex(name => name === metricName);
  const metricColtype =
    metricColtypeIndex > -1 ? coltypes[metricColtypeIndex] : null;

  if (data.length > 0) {
    const sortedData = (data as BigNumberDatum[])
      .map(d => [d[xAxisLabel], parseMetricValue(d[metricName])])
      // sort in time descending order
      .sort((a, b) => (a[0] !== null && b[0] !== null ? b[0] - a[0] : 0));

    bigNumber = sortedData[0][1];
    timestamp = sortedData[0][0];

    // DODO added 45525377
    if (valueToShow === ValueToShowEnum.AVERAGE) {
      bigNumber =
        sortedData.reduce((acc, item) => acc + (item.at(1) ?? 0), 0) /
        sortedData.length;
      timestamp = null;
    } else if (valueToShow === ValueToShowEnum.OLDEST) {
      bigNumber = sortedData[sortedData.length - 1][1];
      timestamp = sortedData[sortedData.length - 1][0];
    }

    if (bigNumber === null) {
      bigNumberFallback = sortedData.find(d => d[1] !== null);
      bigNumber = bigNumberFallback ? bigNumberFallback[1] : null;
      timestamp = bigNumberFallback ? bigNumberFallback[0] : null;
    }

    if (compareLag > 0) {
      const compareIndex = compareLag;
      if (compareIndex < sortedData.length) {
        const compareValue = sortedData[compareIndex][1];
        // compare values must both be non-nulls
        if (bigNumber !== null && compareValue !== null) {
          percentChange = compareValue
            ? (bigNumber - compareValue) / Math.abs(compareValue)
            : 0;
          formattedSubheader = `${formatPercentChange(
            percentChange,
          )} ${compareSuffix}`;
        }
      }
    }
    sortedData.reverse();
    // @ts-ignore
    trendLineData = showTrendLine ? sortedData : undefined;
  }

  let className = '';
  if (percentChange > 0) {
    className = 'positive';
  } else if (percentChange < 0) {
    className = 'negative';
  }

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricEntry => metricEntry.metric_name === metric,
    );
  }

  const formatTime = getDateFormatter(
    timeFormat,
    granularity,
    metricEntry?.d3format,
  );

  // DODO added 44211769
  const columnConfigImmitation = {
    [isSavedMetric(metric) ? metric : metric.label || '']: {
      d3NumberFormat: yAxisFormat,
    },
  };

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
    undefined, // DODO added 44211769
    datasourceMetrics, // DODO added 44211769
    columnConfigImmitation, // DODO added 44211769
  );

  const headerFormatter =
    metricColtype === GenericDataType.Temporal ||
    metricColtype === GenericDataType.String ||
    forceTimestampFormatting
      ? formatTime
      : numberFormatter;

  if (trendLineData && timeRangeFixed && fromDatetime) {
    const toDatetimeOrToday = toDatetime ?? Date.now();
    if (!trendLineData[0][0] || trendLineData[0][0] > fromDatetime) {
      trendLineData.unshift([fromDatetime, null]);
    }
    if (
      !trendLineData[trendLineData.length - 1][0] ||
      trendLineData[trendLineData.length - 1][0]! < toDatetimeOrToday
    ) {
      trendLineData.push([toDatetimeOrToday, null]);
    }
  }

  const echartOptions: EChartsCoreOption = trendLineData
    ? {
        series: [
          {
            data: trendLineData,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 10,
            showSymbol: false,
            color: mainColor,
            areaStyle: {
              color: new graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: mainColor,
                },
                {
                  offset: 1,
                  color: theme.colors.grayscale.light5,
                },
              ]),
            },
          },
        ],
        xAxis: {
          min: trendLineData[0][0],
          max: trendLineData[trendLineData.length - 1][0],
          show: false,
          type: 'value',
        },
        yAxis: {
          scale: !startYAxisAtZero,
          show: false,
        },
        grid: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
        tooltip: {
          ...getDefaultTooltip(refs),
          show: !inContextMenu,
          trigger: 'axis',
          formatter: (params: { data: TimeSeriesDatum }[]) =>
            tooltipHtml(
              [
                [
                  metricName,
                  params[0].data[1] === null
                    ? t('N/A')
                    : headerFormatter.format(params[0].data[1]),
                ],
              ],
              formatTime(params[0].data[0]),
            ),
        },
        aria: {
          enabled: true,
          label: {
            description: `Big number visualization ${subheader}`,
          },
        },
      }
    : {};

  const { onContextMenu } = hooks;

  // DODO added start 45525377
  const {
    percentChangeFormatter,
    colorThresholdFormatters,
    percentChangeNumber,
  } = BigNumberWithTrendLineTransformPropsDodo({
    formData,
    data,
    percentChange,
    formatPercentChange,
  });
  const conditionalMessageColorFormatters =
    getColorFormattersWithConditionalMessage(conditionalFormattingMessage) ??
    [];
  // DODO added stop 45525377

  return {
    width,
    height,
    bigNumber,
    // @ts-ignore
    bigNumberFallback,
    className,
    headerFormatter,
    formatTime,
    formData,
    headerFontSize,
    subheaderFontSize,
    mainColor,
    showTimestamp,
    showTrendLine,
    startYAxisAtZero,
    subheader: formattedSubheader,
    timestamp,
    trendLineData,
    echartOptions,
    onContextMenu,
    xValueFormatter: formatTime,
    refs,
    // DODO added start 45525377
    colorThresholdFormatters,
    percentChange: percentChangeNumber,
    percentChangeFormatter,
    conditionalMessageColorFormatters,
    conditionalMessageFontSize,
    alignment,
    // DODO added stop 45525377
  };
}
