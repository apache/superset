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
  ColorFormatters,
  getColorFormatters,
  Metric,
} from '@superset-ui/chart-controls';
import {
  GenericDataType,
  getMetricLabel,
  extractTimegrain,
  QueryFormData,
  getValueFormatter,
} from '@superset-ui/core';
import { BigNumberTotalChartProps, BigNumberVizProps } from '../types';
import { getDateFormatter, getOriginalLabel, parseMetricValue } from '../utils';
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
    datasource: { currencyFormats = {}, columnFormats = {} },
    theme,
  } = chartProps;
  const {
    metricNameFontSize,
    headerFontSize,
    metric = 'value',
    subtitle,
    subtitleFontSize,
    forceTimestampFormatting,
    timeFormat,
    yAxisFormat,
    conditionalFormatting,
    currencyFormat,
    subheader,
    subheaderFontSize,
  } = formData;
  const refs: Refs = {};
  const { data = [], coltypes = [] } = queriesData[0] || {};
  const granularity = extractTimegrain(rawFormData as QueryFormData);
  const metrics = chartProps.datasource?.metrics || [];
  const originalLabel = getOriginalLabel(metric, metrics);
  const metricName = getMetricLabel(metric);
  const showMetricName = chartProps.rawFormData?.show_metric_name ?? false;
  const formattedSubtitle = subtitle?.trim() ? subtitle : subheader || '';
  const formattedSubtitleFontSize = subtitle?.trim()
    ? (subtitleFontSize ?? 1)
    : (subheaderFontSize ?? 1);
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

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    metricEntry?.d3format || yAxisFormat,
    currencyFormat,
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
    getColorFormatters(conditionalFormatting, data, theme, false) ??
    defaultColorFormatters;
  return {
    width,
    height,
    bigNumber,
    headerFormatter,
    headerFontSize,
    subheaderFontSize,
    subtitleFontSize: formattedSubtitleFontSize,
    subtitle: formattedSubtitle,
    onContextMenu,
    refs,
    colorThresholdFormatters,
    metricName: originalLabel,
    showMetricName,
    metricNameFontSize,
  };
}
