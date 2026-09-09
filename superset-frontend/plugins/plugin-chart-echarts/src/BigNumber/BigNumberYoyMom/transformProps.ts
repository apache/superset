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
import { t } from '@apache-superset/core/translation';
import {
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  Metric,
  NumberFormats,
  QueryFormMetric,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { GraphicComponentOption } from 'echarts/components';
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BIG_NUMBER_COLOR,
  DEFAULT_BIG_NUMBER_FONT_SIZE,
  DEFAULT_BIG_NUMBER_LEFT,
  DEFAULT_BIG_NUMBER_TOP,
  DEFAULT_COMPARISON1_LABEL,
  DEFAULT_COMPARISON1_LEFT,
  DEFAULT_COMPARISON1_OFFSET,
  DEFAULT_COMPARISON2_LABEL,
  DEFAULT_COMPARISON2_LEFT,
  DEFAULT_COMPARISON2_OFFSET,
  DEFAULT_COMPARISON_FONT_SIZE,
  DEFAULT_COMPARISON_NEGATIVE_COLOR,
  DEFAULT_COMPARISON_POSITIVE_COLOR,
  DEFAULT_COMPARISON_TOP,
  DEFAULT_COMPARISON_ZERO_COLOR,
  DEFAULT_TITLE_COLOR,
  DEFAULT_TITLE_FONT_SIZE,
  DEFAULT_TITLE_LEFT,
  DEFAULT_TITLE_TOP,
} from './constants';
import {
  BigNumberYoyMomChartProps,
  BigNumberYoyMomProps,
  RGBColor,
} from './types';
import {
  alignToTimeGrain,
  parseTimePointValue,
  shiftPointToOffset,
} from './timeRange';

const toCssColor = (color?: RGBColor, fallback?: string) =>
  color ? `rgb(${color.r}, ${color.g}, ${color.b})` : fallback;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Percentage change between the current value and a comparison value.
 * Mirrors the Big Number with Time Period Comparison behavior: no data on
 * either side yields null (rendered as "—"), both zero yields 0%, and a zero
 * denominator yields +/-100%.
 */
const computePercent = (
  current: number | null,
  previous: number | null,
): number | null => {
  if (current === null || previous === null) return null;
  if (!current && !previous) return 0;
  if (!previous) return current ? 1 : -1;
  return (current - previous) / Math.abs(previous);
};

type ComparisonSlot = {
  show: boolean;
  label: string;
  offset?: string;
  column?: QueryFormMetric;
  left: number;
  current: number | null;
  comparisonValue: number | string | null | undefined;
};

// A comparison slot reads its value either from a configured comparison
// metric (dataset metric or custom SQL expression) or from the backend's
// time-offset column `<metric label>__<offset>`. The mode mirrors buildQuery:
// an unset mode falls back to the metric when a comparison column exists.
const isMetricMode = (
  mode: 'time_shift' | 'metric' | undefined,
  column: QueryFormMetric | undefined,
): boolean => mode === 'metric' || (!mode && !!column);

export default function transformProps(
  chartProps: BigNumberYoyMomChartProps,
): BigNumberYoyMomProps {
  const {
    width,
    height,
    queriesData,
    formData,
    datasource: {
      currencyFormats = {},
      columnFormats = {},
      currencyCodeColumn,
    },
  } = chartProps;
  const {
    metric = 'value',
    yAxisFormat,
    currencyFormat,
    headerText = '',
    titleFontSize = DEFAULT_TITLE_FONT_SIZE,
    titleColor = DEFAULT_TITLE_COLOR,
    titleLeft = DEFAULT_TITLE_LEFT,
    titleTop = DEFAULT_TITLE_TOP,
    bigNumberFontSize = DEFAULT_BIG_NUMBER_FONT_SIZE,
    bigNumberColor = DEFAULT_BIG_NUMBER_COLOR,
    bigNumberLeft = DEFAULT_BIG_NUMBER_LEFT,
    bigNumberTop = DEFAULT_BIG_NUMBER_TOP,
    showComparison1 = true,
    comparison1Label = t(DEFAULT_COMPARISON1_LABEL),
    comparison1Offset = DEFAULT_COMPARISON1_OFFSET,
    comparison1Column,
    comparison1Mode,
    comparison1Left = DEFAULT_COMPARISON1_LEFT,
    showComparison2 = true,
    comparison2Label = t(DEFAULT_COMPARISON2_LABEL),
    comparison2Offset = DEFAULT_COMPARISON2_OFFSET,
    comparison2Column,
    comparison2Mode,
    comparison2Left = DEFAULT_COMPARISON2_LEFT,
    comparisonFontSize = DEFAULT_COMPARISON_FONT_SIZE,
    comparisonTop = DEFAULT_COMPARISON_TOP,
    comparisonPositiveColor = DEFAULT_COMPARISON_POSITIVE_COLOR,
    comparisonNegativeColor = DEFAULT_COMPARISON_NEGATIVE_COLOR,
    comparisonZeroColor = DEFAULT_COMPARISON_ZERO_COLOR,
    percentDifferenceFormat = NumberFormats.PERCENT_2_POINT,
    backgroundColor = DEFAULT_BACKGROUND_COLOR,
    timeGrainSqla,
  } = formData;

  const { data = [], detected_currency: detectedCurrency } =
    queriesData[0] || {};
  const hasData = data.length > 0;
  const metricName = getMetricLabel(metric);

  // Point-to-point comparison: buildQuery returns a second query with the
  // metric grouped by the time column (newest first) when a time shift is
  // configured without an enclosed time range ("No filter"). The comparison
  // value for an offset is the series point that matches the newest point
  // shifted by that offset; points that do not exist render as "—".
  const seriesQuery = queriesData[1];
  const seriesData = seriesQuery?.data ?? [];
  const seriesTimeColumn = seriesQuery?.colnames?.[0];
  const pointSeries = hasData && seriesData.length > 0 ? seriesData : null;
  const seriesPoints = pointSeries
    ? (pointSeries
        .map(row => {
          const time = seriesTimeColumn
            ? parseTimePointValue(row[seriesTimeColumn])
            : null;
          return time ? { time, value: toNumber(row[metricName]) } : null;
        })
        .filter(
          (point): point is { time: Date; value: number | null } =>
            point !== null,
        ) ?? [])
    : [];
  const latestPoint = seriesPoints.reduce(
    (latest, point) =>
      latest === null || point.time.getTime() > latest.time.getTime()
        ? point
        : latest,
    null as { time: Date; value: number | null } | null,
  );
  const matchPointOffset = (offset: string | undefined): number | null => {
    if (!offset || !latestPoint) return null;
    const target = alignToTimeGrain(
      shiftPointToOffset(latestPoint.time, offset),
      timeGrainSqla,
    );
    const hit = seriesPoints.find(
      point =>
        alignToTimeGrain(point.time, timeGrainSqla).getTime() ===
        target.getTime(),
    );
    return hit ? hit.value : null;
  };

  const metricEntry: Metric | undefined = chartProps.datasource?.metrics?.find(
    metricItem => metricItem.metric_name === metric,
  );

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    metricEntry?.d3format || yAxisFormat,
    currencyFormat,
    undefined,
    data,
    currencyCodeColumn,
    detectedCurrency,
  );
  const percentFormatter = getNumberFormatter(percentDifferenceFormat);

  const row = data[0] || {};
  const rawBigNumber = hasData ? row[metricName] : null;
  const current = toNumber(rawBigNumber);

  const graphic: GraphicComponentOption[] = [];

  // Without a title the big number moves up into the title's spot
  // (titleTop) so dashboards do not show an empty strip at the top. The
  // comparison line always sits below the big number's bottom edge (font
  // size * 1.2 line height + gap), so a larger number pushes it down instead
  // of overlapping. With a title the configured comparisonTop acts as a
  // lower bound; without a title the line simply follows the number.
  const hasTitle = !!headerText;
  const bigNumberRowHeight = bigNumberFontSize * 1.2;
  const effectiveBigNumberTop = hasTitle ? bigNumberTop : titleTop;
  const effectiveComparisonTop = hasTitle
    ? Math.max(comparisonTop, effectiveBigNumberTop + bigNumberRowHeight + 5)
    : effectiveBigNumberTop + bigNumberRowHeight + 5;

  if (headerText) {
    graphic.push({
      type: 'text',
      left: titleLeft,
      top: titleTop,
      style: {
        text: headerText,
        fontSize: titleFontSize,
        fill: toCssColor(titleColor, '#666'),
      },
    });
  }

  let bigNumberText = t('No data');
  if (hasData && rawBigNumber !== null && rawBigNumber !== undefined) {
    bigNumberText =
      typeof rawBigNumber === 'number'
        ? numberFormatter(rawBigNumber)
        : String(rawBigNumber);
  }

  graphic.push({
    type: 'text',
    left: bigNumberLeft,
    top: effectiveBigNumberTop,
    style: {
      text: bigNumberText,
      fontSize: bigNumberFontSize,
      fontWeight: 'bold',
      fill: toCssColor(bigNumberColor, '#333'),
    },
  });

  const positiveColor = toCssColor(
    comparisonPositiveColor,
    '#00b42a',
  ) as string;
  const negativeColor = toCssColor(
    comparisonNegativeColor,
    '#f53f3f',
  ) as string;
  const zeroColor = toCssColor(comparisonZeroColor, '#666') as string;

  const buildComparison = ({
    show,
    label,
    offset,
    column,
    left,
    current: slotCurrent,
    comparisonValue,
  }: ComparisonSlot): GraphicComponentOption | null => {
    if (!show) return null;
    if (!offset && !column) return null;
    const comparison = toNumber(comparisonValue);
    const percent = computePercent(slotCurrent, comparison);
    const missing = comparison === null;

    let text: string;
    if (missing || percent === null) {
      text = `${label ? `${label} ` : ''}—`;
    } else {
      const arrow = percent > 0 ? '↑' : percent < 0 ? '↓' : '';
      text = `${label ? `${label} ` : ''}${arrow}${percentFormatter(
        Math.abs(percent),
      )}`;
    }
    const fill =
      missing || percent === null || percent === 0
        ? zeroColor
        : percent > 0
          ? positiveColor
          : negativeColor;
    return {
      type: 'text',
      left,
      top: effectiveComparisonTop,
      style: {
        text,
        fontSize: comparisonFontSize,
        fill,
      },
    };
  };

  const slotComparisonValue = (
    mode: 'time_shift' | 'metric' | undefined,
    column: QueryFormMetric | undefined,
    offset: string | undefined,
  ): number | string | null | undefined => {
    if (!hasData) return null;
    if (isMetricMode(mode, column)) {
      return column ? row[getMetricLabel(column)] : null;
    }
    if (pointSeries && offset) return matchPointOffset(offset);
    return offset ? row[`${metricName}__${offset}`] : null;
  };

  // For point-to-point time shifts the percentage compares the newest series
  // point against the shifted point (e.g. latest month vs previous month),
  // not the overall main value. Other slots compare against the main value.
  const slotCurrent = (
    mode: 'time_shift' | 'metric' | undefined,
    column: QueryFormMetric | undefined,
  ): number | null => {
    if (pointSeries && !isMetricMode(mode, column)) {
      return latestPoint ? latestPoint.value : null;
    }
    return current;
  };

  const comparison1 = buildComparison({
    show: showComparison1,
    label: comparison1Label,
    offset: comparison1Offset,
    column: comparison1Column,
    left: comparison1Left,
    current: slotCurrent(comparison1Mode, comparison1Column),
    comparisonValue: slotComparisonValue(
      comparison1Mode,
      comparison1Column,
      comparison1Offset,
    ),
  });
  const comparison2 = buildComparison({
    show: showComparison2,
    label: comparison2Label,
    offset: comparison2Offset,
    column: comparison2Column,
    left: comparison2Left,
    current: slotCurrent(comparison2Mode, comparison2Column),
    comparisonValue: slotComparisonValue(
      comparison2Mode,
      comparison2Column,
      comparison2Offset,
    ),
  });
  if (comparison1) graphic.push(comparison1);
  if (comparison2) graphic.push(comparison2);

  const echartOptions: EChartsCoreOption = {
    backgroundColor: toCssColor(backgroundColor, '#fff'),
    tooltip: { show: false },
    graphic,
    xAxis: { show: false },
    yAxis: { show: false },
    series: [],
  };

  return {
    width,
    height,
    echartOptions,
    refs: {},
    formData,
  };
}
