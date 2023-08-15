// DODO was here
import {
  getNumberFormatter,
  GenericDataType,
  getMetricLabel,
  extractTimegrain,
  QueryFormData,
} from '@superset-ui/core';
import { BigNumberTotalChartProps } from '../types';
import { getDateFormatter, parseMetricValue } from '../utils';

export default function transformProps(chartProps: BigNumberTotalChartProps) {
  const { width, height, queriesData, formData, rawFormData } = chartProps;
  const {
    headerFontSize,
    metric = 'value',
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    timeFormat,
    yAxisFormat,
    conditionalFormatting,
  } = formData;

  const { data = [], coltypes = [] } = queriesData[0];
  const granularity = extractTimegrain(rawFormData as QueryFormData);
  const metricName = getMetricLabel(metric);
  const formattedSubheader = subheader;
  const bigNumber =
    data.length === 0 ? null : parseMetricValue(data[0][metricName]);

  let metricEntry;
  if (chartProps.datasource && chartProps.datasource.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricItem => metricItem.metric_name === metric,
    );
  }

  const formatTime = getDateFormatter(
    timeFormat,
    granularity,
    metricEntry?.d3format,
  );

  const headerFormatter =
    coltypes[0] === GenericDataType.TEMPORAL ||
    coltypes[0] === GenericDataType.STRING ||
    forceTimestampFormatting
      ? formatTime
      : getNumberFormatter(yAxisFormat ?? metricEntry?.d3format ?? undefined);

  return {
    width,
    height,
    bigNumber,
    headerFormatter,
    headerFontSize,
    subheaderFontSize,
    subheader: formattedSubheader,
    conditionalFormatting,
  };
}
