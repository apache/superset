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

/**
 * Big Number (Total) - Glyph Pattern Implementation
 *
 * Showcases a single metric front-and-center. Best used to call attention
 * to a KPI or the one thing you want your audience to focus on.
 */

import { t } from '@apache-superset/core/translation';
import {
  Behavior,
  extractTimegrain,
  getMetricLabel,
  getValueFormatter,
  QueryFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ColorFormatters,
  getColorFormatters,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

import {
  defineChart,
  NumberFormat,
  Currency,
  TimeFormat,
  HeaderFontSize,
  SubheaderFontSize,
  Subtitle,
  ForceTimestampFormatting,
  ShowMetricName,
  MetricNameFontSize,
  ConditionalFormatting,
  ChartProps,
} from '@superset-ui/glyph-core';

import { getDateFormatter, getOriginalLabel, parseMetricValue } from '../utils';
import BigNumberViz from '../BigNumberViz';
import { BigNumberTotalChartProps, BigNumberVizProps } from '../types';
import { Refs } from '../../types';

import example1 from './images/BigNumber.jpg';
import example1Dark from './images/BigNumber-dark.jpg';
import example2 from './images/BigNumber2.jpg';
import example2Dark from './images/BigNumber2-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

// ============================================================================
// Transform
// ============================================================================

interface BigNumberTotalTransformResult {
  vizProps: BigNumberVizProps;
}

function transformBigNumberTotal(
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

  let metricD3Format: string | undefined;
  if (chartProps.datasource?.metrics) {
    const metricEntry = chartProps.datasource.metrics.find(
      (metricItem: { metric_name?: string }) =>
        metricItem.metric_name === metric,
    );
    metricD3Format = metricEntry?.d3format ?? undefined;
  }

  const formatTime = getDateFormatter(timeFormat, granularity, metricD3Format);

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    metricD3Format || yAxisFormat,
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

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  BigNumberTotalTransformResult
>({
  metadata: {
    name: t('Big Number'),
    description: t(
      'Showcases a single metric front-and-center. Big number is best used to call attention to a KPI or the one thing you want your audience to focus on.',
    ),
    category: t('KPI'),
    tags: [
      t('Additive'),
      t('Business'),
      t('ECharts'),
      t('Legacy'),
      t('Percentages'),
      t('Featured'),
      t('Report'),
    ],
    thumbnail,
    thumbnailDark,
    behaviors: [Behavior.DrillToDetail],
    exampleGallery: [
      { url: example1, urlDark: example1Dark, caption: t('A Big Number') },
      {
        url: example2,
        urlDark: example2Dark,
        caption: t('With a subheader'),
      },
    ],
  },

  arguments: {
    headerFontSize: HeaderFontSize,
    subtitle: Subtitle,
    subtitleFontSize: SubheaderFontSize,
    showMetricName: ShowMetricName,
    metricNameFontSize: {
      arg: MetricNameFontSize,
      visibleWhen: { showMetricName: true },
    },
    yAxisFormat: NumberFormat.with({
      label: t('Number format'),
    }),
    currencyFormat: Currency,
    timeFormat: TimeFormat,
    forceTimestampFormatting: ForceTimestampFormatting,
    conditionalFormatting: ConditionalFormatting.with({
      label: t('Conditional Formatting'),
      description: t('Apply conditional color formatting to metric'),
    }),
  },

  additionalControls: {
    query: [['metric'], ['adhoc_filters']],
  },

  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
  },

  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
  }),

  transform: (chartProps: ChartProps): BigNumberTotalTransformResult => ({
    vizProps: transformBigNumberTotal(chartProps as BigNumberTotalChartProps),
  }),

  render: ({ vizProps }) => <BigNumberViz {...vizProps} />,
});
