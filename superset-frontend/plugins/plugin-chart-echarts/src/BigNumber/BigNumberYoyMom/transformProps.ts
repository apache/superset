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
  DEFAULT_BIG_NUMBER_COLOR,
  DEFAULT_BIG_NUMBER_FONT_SIZE,
  DEFAULT_BIG_NUMBER_LEFT,
  DEFAULT_COMPARISON1_LABEL,
  DEFAULT_COMPARISON1_OFFSET,
  DEFAULT_COMPARISON2_LABEL,
  DEFAULT_COMPARISON_GAP,
  DEFAULT_COMPARISON2_OFFSET,
  DEFAULT_COMPARISON_FONT_SIZE,
  DEFAULT_COMPARISON_NEGATIVE_COLOR,
  DEFAULT_COMPARISON_POSITIVE_COLOR,
  DEFAULT_COMPARISON_ZERO_COLOR,
  DEFAULT_TITLE_COLOR,
  DEFAULT_TITLE_FONT_SIZE,
  DEFAULT_TITLE_LEFT,
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
 * 'comparison1Left' -> 'comparison1_left'. Form data keys follow the
 * snake_case control names Explore saves; callers sometimes pass camelCase.
 */
const camelToSnake = (key: string): string =>
  key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/**
 * Normalize a position/gap control value. Any non-numeric input (blank
 * string, null, NaN) is treated as 0, so clearing the control or typing
 * invalid characters produces the same layout as an explicit 0.
 */
const normalizePosition = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Read a comparison value column from a result row. Saved metrics are plain
 * column names; adhoc metrics are named by their label, or by the SQL
 * expression itself when no label is set. The backend may normalize
 * whitespace in expression column names, so fall back to a
 * whitespace-insensitive match before giving up.
 */
const readMetricValue = (
  row: Record<string, unknown>,
  column: QueryFormMetric,
): number | string | null | undefined => {
  const asScalar = (value: unknown): number | string | null | undefined =>
    typeof value === 'number' || typeof value === 'string'
      ? value
      : value == null
        ? null
        : undefined;
  if (typeof column === 'string') return asScalar(row[column]);
  const sqlExpression =
    column.expressionType === 'SQL' ? column.sqlExpression : undefined;
  const candidates = [column.label, sqlExpression].filter(
    (key): key is string => !!key,
  );
  for (const key of candidates) {
    if (row[key] !== undefined) return asScalar(row[key]);
  }
  if (sqlExpression) {
    const expression = sqlExpression.replace(/\s+/g, '');
    const match = Object.keys(row).find(
      key => key.replace(/\s+/g, '') === expression,
    );
    if (match) return asScalar(row[match]);
  }
  return undefined;
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
  mode?: 'time_shift' | 'metric';
  current: number | null;
  comparisonValue: number | string | null | undefined;
  formatter: (value: number) => string;
  valueFormatter: (value: number) => string;
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
  // Form data keys follow the snake_case control names that Explore saves.
  // Tolerate camelCase too (older form data / direct callers) by falling
  // back to the snake_case spelling when the camelCase key is absent.
  const formDataRecord = formData as unknown as Record<string, unknown>;
  const pick = <T,>(key: string): T | undefined =>
    (formDataRecord[key] ?? formDataRecord[camelToSnake(key)]) as T | undefined;
  const metric = pick<string>('metric') ?? 'value';
  const yAxisFormat = pick<string>('yAxisFormat');
  const currencyFormat = pick<Parameters<typeof getValueFormatter>[4]>(
    'currencyFormat',
  );
  const headerText = pick<string>('headerText') ?? '';
  const titleFontSize =
    pick<number>('titleFontSize') ?? DEFAULT_TITLE_FONT_SIZE;
  const titleColor = pick<RGBColor>('titleColor') ?? DEFAULT_TITLE_COLOR;
  const titleLeft = pick<number>('titleLeft') ?? DEFAULT_TITLE_LEFT;
  const titleTop = pick<number>('titleTop');
  const bigNumberFontSize =
    pick<number>('bigNumberFontSize') ?? DEFAULT_BIG_NUMBER_FONT_SIZE;
  const bigNumberColor =
    pick<RGBColor>('bigNumberColor') ?? DEFAULT_BIG_NUMBER_COLOR;
  const bigNumberLeft =
    pick<number>('bigNumberLeft') ?? DEFAULT_BIG_NUMBER_LEFT;
  const bigNumberTop = pick<number>('bigNumberTop');
  const showComparison1 = pick<boolean>('showComparison1') ?? true;
  const comparison1Label =
    pick<string>('comparison1Label') ?? t(DEFAULT_COMPARISON1_LABEL);
  const comparison1Offset =
    pick<string>('comparison1Offset') ?? DEFAULT_COMPARISON1_OFFSET;
  const comparison1Column = pick<QueryFormMetric>('comparison1Column');
  const comparison1PercentDifferenceFormat = pick<string>(
    'comparison1PercentDifferenceFormat',
  );
  const legacyComparison1Left = pick<number>('comparison1Left');
  const comparison1Mode = pick<'time_shift' | 'metric'>('comparison1Mode');
  const showComparison2 = pick<boolean>('showComparison2') ?? true;
  const comparison2Label =
    pick<string>('comparison2Label') ?? t(DEFAULT_COMPARISON2_LABEL);
  const comparison2Offset =
    pick<string>('comparison2Offset') ?? DEFAULT_COMPARISON2_OFFSET;
  const comparison2Column = pick<QueryFormMetric>('comparison2Column');
  const comparison2PercentDifferenceFormat = pick<string>(
    'comparison2PercentDifferenceFormat',
  );
  const legacyComparison2Left = pick<number>('comparison2Left');
  const comparison2Mode = pick<'time_shift' | 'metric'>('comparison2Mode');
  const comparisonGap = pick<number>('comparisonGap') ?? DEFAULT_COMPARISON_GAP;
  const swapComparisonOrder = pick<boolean>('swapComparisonOrder') ?? false;
  const comparisonFontSize =
    pick<number>('comparisonFontSize') ?? DEFAULT_COMPARISON_FONT_SIZE;
  const comparisonTop = pick<number>('comparisonTop');
  const comparisonPositiveColor =
    pick<RGBColor>('comparisonPositiveColor') ??
    DEFAULT_COMPARISON_POSITIVE_COLOR;
  const comparisonNegativeColor =
    pick<RGBColor>('comparisonNegativeColor') ??
    DEFAULT_COMPARISON_NEGATIVE_COLOR;
  const comparisonZeroColor =
    pick<RGBColor>('comparisonZeroColor') ?? DEFAULT_COMPARISON_ZERO_COLOR;
  const percentDifferenceFormat =
    pick<string>('percentDifferenceFormat') ?? NumberFormats.PERCENT_2_POINT;
  const timeGrainSqla = pick<string>('timeGrainSqla');

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
  // MoM and YoY each carry their own percent difference format, falling back
  // to the legacy global control for charts saved before the split.
  // d3 percentage formats (e.g. ",.2%") scale the value by 100 and append the
  // "%" sign themselves; plain number formats (",.2f", Smart Number) expect
  // the already-scaled percentage value, so multiply by 100 before formatting.
  const formatPercentValue = (
    format: string | undefined,
    percent: number,
  ): string => {
    const d3Format = format || percentDifferenceFormat;
    const formatter = getNumberFormatter(d3Format);
    return formatter(d3Format.includes('%') ? percent : percent * 100);
  };
  const percentFormatter1 = (value: number) =>
    formatPercentValue(comparison1PercentDifferenceFormat, value);
  const percentFormatter2 = (value: number) =>
    formatPercentValue(comparison2PercentDifferenceFormat, value);
  // Comparison value metrics render with the slot's configured number format
  // (the same control used for percent differences), falling back to the
  // default Smart Number format when unset.
  const valueFormatter1 = (value: number) =>
    getNumberFormatter(comparison1PercentDifferenceFormat)(value);
  const valueFormatter2 = (value: number) =>
    getNumberFormatter(comparison2PercentDifferenceFormat)(value);

  const row = data[0] || {};
  const rawBigNumber = hasData ? row[metricName] : null;
  const current = toNumber(rawBigNumber);

  const graphic: GraphicComponentOption[] = [];

  // Auto-positioning keeps the text stack compact and centered, matching the
  // flex-centered layout used by the other Big Number visualizations.
  // The title font size follows the shared Subtitle Font Size control:
  // ratios (<= 1, Tiny 0.125 .. Huge 0.4) are multiplied by the chart
  // height; legacy numeric values > 1 are absolute pixels.
  const hasTitle = !!headerText;
  const titleFontSizeValue =
    typeof titleFontSize === 'number'
      ? titleFontSize
      : Number(titleFontSize) || DEFAULT_TITLE_FONT_SIZE;
  const titleFontSizePx =
    titleFontSizeValue <= 1
      ? Math.ceil(titleFontSizeValue * height)
      : Math.ceil(titleFontSizeValue);
  const bigNumberFontSizeValue =
    typeof bigNumberFontSize === 'number'
      ? bigNumberFontSize
      : Number(bigNumberFontSize) || DEFAULT_BIG_NUMBER_FONT_SIZE;
  const bigNumberFontSizePx =
    bigNumberFontSizeValue <= 1
      ? Math.ceil(bigNumberFontSizeValue * height)
      : Math.ceil(bigNumberFontSizeValue);
  const comparisonFontSizeValue =
    typeof comparisonFontSize === 'number'
      ? comparisonFontSize
      : Number(comparisonFontSize) || DEFAULT_COMPARISON_FONT_SIZE;
  const comparisonFontSizePx =
    comparisonFontSizeValue <= 1
      ? Math.ceil(comparisonFontSizeValue * height)
      : Math.ceil(comparisonFontSizeValue);
  const titleRowHeight = titleFontSizePx * 1.2;
  const bigNumberRowHeight = bigNumberFontSizePx * 1.2;
  const comparisonRowHeight = comparisonFontSizePx * 1.2;
  const titleTopValue = normalizePosition(titleTop);
  const bigNumberTopValue = normalizePosition(bigNumberTop);
  const comparisonTopValue = normalizePosition(comparisonTop);
  const hasComparison =
    (showComparison1 && !!(comparison1Offset || comparison1Column)) ||
    (showComparison2 && !!(comparison2Offset || comparison2Column));
  // Match the Big Number family: the complete text stack is centered in the
  // tile. The configured top values remain minimum padding, while the gap
  // controls preserve the spacing inside the stack.
  const contentHeight =
    (hasTitle ? titleRowHeight + bigNumberTopValue : 0) +
    bigNumberRowHeight +
    (hasComparison ? comparisonTopValue + comparisonRowHeight : 0);
  const contentTop = Math.max(titleTopValue, (height - contentHeight) / 2);
  const effectiveTitleTop = hasTitle ? contentTop : titleTopValue;
  const effectiveBigNumberTop = hasTitle
    ? contentTop + titleRowHeight + bigNumberTopValue
    : contentTop;
  const effectiveComparisonTop =
    effectiveBigNumberTop + bigNumberRowHeight + comparisonTopValue;

  if (headerText) {
    graphic.push({
      type: 'text',
      left: titleLeft,
      top: effectiveTitleTop,
      style: {
        text: headerText,
        fontSize: titleFontSizePx,
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
      fontSize: bigNumberFontSizePx,
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
  const comparisonLeft = 20;
  const comparisonGapPx = Math.max(0, Number(comparisonGap) || 0);

  const slotComparisonValue = (
    mode: 'time_shift' | 'metric' | undefined,
    column: QueryFormMetric | undefined,
    offset: string | undefined,
  ): number | string | null | undefined => {
    if (!hasData) return null;
    if (isMetricMode(mode, column)) {
      return column ? readMetricValue(row, column) : null;
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

  const buildComparisonContent = ({
    show,
    label,
    offset,
    column,
    mode,
    current: slotCurrent,
    comparisonValue,
    formatter,
    valueFormatter,
  }: ComparisonSlot): { text: string; fill: string } | null => {
    if (!show) return null;
    if (!offset && !column) return null;
    const comparison = toNumber(comparisonValue);
    const missing = comparison === null;

    // A comparison value metric (dataset column or custom SQL) supplies the
    // value itself, so render it like the big number instead of computing a
    // percentage change. Time shifts keep the percentage-difference display.
    if (isMetricMode(mode, column)) {
      if (missing) {
        return {
          text: `${label ? `${label} ` : ''}—`,
          fill: zeroColor,
        };
      }
      const arrow = comparison > 0 ? '↑' : comparison < 0 ? '↓' : '';
      return {
        text: `${label ? `${label} ` : ''}${arrow}${valueFormatter(
          comparison,
        )}`,
        fill:
          comparison > 0
            ? positiveColor
            : comparison < 0
              ? negativeColor
              : zeroColor,
      };
    }

    const percent = computePercent(slotCurrent, comparison);
    let text: string;
    if (missing || percent === null) {
      text = `${label ? `${label} ` : ''}—`;
    } else {
      const arrow = percent > 0 ? '↑' : percent < 0 ? '↓' : '';
      text = `${label ? `${label} ` : ''}${arrow}${formatter(
        Math.abs(percent),
      )}`;
    }
    const fill =
      missing || percent === null || percent === 0
        ? zeroColor
        : percent > 0
          ? positiveColor
          : negativeColor;
    return { text, fill };
  };

  // Estimate the rendered width of a comparison line so the second slot is
  // pushed past the first one even when no extra gap is configured. Full-width
  // characters (labels, arrows) are wider than ASCII digits and separators.
  const estimateTextWidth = (text: string, fontSizePx: number): number =>
    Math.ceil(
      Array.from(text).reduce(
        (width, char) => width + (char.charCodeAt(0) > 255 ? 1.1 : 0.62),
        0,
      ) * fontSizePx,
    );

  const comparison1Content = buildComparisonContent({
    show: showComparison1,
    label: comparison1Label,
    offset: comparison1Offset,
    column: comparison1Column,
    mode: comparison1Mode,
    current: slotCurrent(comparison1Mode, comparison1Column),
    comparisonValue: slotComparisonValue(
      comparison1Mode,
      comparison1Column,
      comparison1Offset,
    ),
    formatter: percentFormatter1,
    valueFormatter: valueFormatter1,
  });
  const comparison2Content = buildComparisonContent({
    show: showComparison2,
    label: comparison2Label,
    offset: comparison2Offset,
    column: comparison2Column,
    mode: comparison2Mode,
    current: slotCurrent(comparison2Mode, comparison2Column),
    comparisonValue: slotComparisonValue(
      comparison2Mode,
      comparison2Column,
      comparison2Offset,
    ),
    formatter: percentFormatter2,
    valueFormatter: valueFormatter2,
  });
  const comparisonWidth = Math.max(
    comparison1Content
      ? estimateTextWidth(comparison1Content.text, comparisonFontSizePx)
      : 0,
    comparison2Content
      ? estimateTextWidth(comparison2Content.text, comparisonFontSizePx)
      : 0,
  );
  const comparisonLefts =
    legacyComparison1Left !== undefined || legacyComparison2Left !== undefined
      ? [
          legacyComparison1Left ?? comparisonLeft,
          legacyComparison2Left ??
            comparisonLeft + comparisonWidth + comparisonGapPx,
        ]
      : swapComparisonOrder
        ? [comparisonLeft + comparisonWidth + comparisonGapPx, comparisonLeft]
        : [comparisonLeft, comparisonLeft + comparisonWidth + comparisonGapPx];

  const pushComparison = (
    content: { text: string; fill: string } | null,
    left: number,
  ) => {
    if (!content) return;
    graphic.push({
      type: 'text',
      left,
      top: effectiveComparisonTop,
      style: {
        text: content.text,
        fontSize: comparisonFontSizePx,
        fill: content.fill,
      },
    });
  };
  pushComparison(comparison1Content, comparisonLefts[0]);
  pushComparison(comparison2Content, comparisonLefts[1]);

  const echartOptions: EChartsCoreOption = {
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
