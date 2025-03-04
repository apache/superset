// DODO was here
import {
  ColorFormatters,
  getColorFormatters,
  getColorFormattersWithConditionalMessage, // DODO added 45525377
  Metric,
} from '@superset-ui/chart-controls';
import {
  GenericDataType,
  getMetricLabel,
  extractTimegrain,
  QueryFormData,
  getValueFormatter,
  isSavedMetric, // DODO added 44211769
} from '@superset-ui/core';
import { BigNumberTotalChartProps, BigNumberVizProps } from '../types';
import { parseMetricValue } from '../utils';
import { getDateFormatter } from '../../utils/getDateFormatter'; // DODO added 45525377
import { Refs } from '../../types';

export default function transformProps(
  chartProps: BigNumberTotalChartProps,
): BigNumberVizProps {
  const {
    width,
    height,
    queriesData,
    formData,
    rawFormData,
    hooks,
    datasource: {
      currencyFormats = {},
      columnFormats = {},
      metrics: datasourceMetrics = [], // DODO added 44211769
    },
  } = chartProps;
  const {
    headerFontSize,
    metric = 'value',
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    timeFormat,
    yAxisFormat,
    conditionalFormatting,
    currencyFormat,
    conditionalFormattingMessage, // DODO added 45525377
    conditionalMessageFontSize, // DODO added 45525377
    alignment, // DODO added 45525377
  } = formData;
  const refs: Refs = {};
  const { data = [], coltypes = [] } = queriesData[0];
  const granularity = extractTimegrain(rawFormData as QueryFormData);
  const metricName = getMetricLabel(metric);
  const formattedSubheader = subheader;
  const bigNumber =
    data.length === 0 ? null : parseMetricValue(data[0][metricName]);

  let metricEntry: Metric | undefined;
  if (chartProps.datasource?.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricItem => metricItem.metric_name === metric,
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
    coltypes[0] === GenericDataType.Temporal ||
    coltypes[0] === GenericDataType.String ||
    forceTimestampFormatting
      ? formatTime
      : numberFormatter;

  const { onContextMenu } = hooks;

  const defaultColorFormatters = [] as ColorFormatters;

  const colorThresholdFormatters =
    getColorFormatters(conditionalFormatting, data, false) ??
    defaultColorFormatters;

  // DODO added 45525377
  const conditionalMessageColorFormatters =
    getColorFormattersWithConditionalMessage(conditionalFormattingMessage) ??
    defaultColorFormatters;

  return {
    width,
    height,
    bigNumber,
    headerFormatter,
    headerFontSize,
    subheaderFontSize,
    subheader: formattedSubheader,
    onContextMenu,
    refs,
    colorThresholdFormatters,
    conditionalMessageColorFormatters, // DODO added 45525377
    conditionalMessageFontSize, // DODO added 45525377
    alignment, // DODO added 45525377
  };
}
