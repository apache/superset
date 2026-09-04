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
  AxisType,
  CurrencyFormatter,
  DataRecord,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  NumberFormatter,
  rgbToHex,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import type { EChartsCoreOption } from 'echarts/core';
import type { CandlestickSeriesOption, LineSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  CandlestickChartTransformedProps,
  EchartsCandlestickChartProps,
  OhlcValue,
  LookupKey,
} from './types';
import {
  CANDLESTICK_SERIES_NAME,
  DEFAULT_DECREASE_COLOR,
  DEFAULT_FORM_DATA,
  DEFAULT_INCREASE_COLOR,
  DIRECTION_LABELS,
  OHLC_LABELS,
} from './constants';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getDefaultTooltip } from '../utils/tooltip';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
} from '../utils/series';
import { convertInteger } from '../utils/convertInteger';
import { mergeCustomEChartOptions } from '../utils/mergeCustomEChartOptions';
import { safeParseEChartOptions } from '../utils/safeEChartOptionsParser';
import { TIMESERIES_CONSTANTS } from '../constants';
import { LegendOrientation, LegendType, Refs } from '../types';
import { resolveLegendLayout } from '../utils/legendLayout';
import {
  calculateMA,
  MA_LINE_OPACITY,
  movingAverageName,
  parseMovingAveragePeriods,
} from './utils';

type CandlestickDatum = NonNullable<CandlestickSeriesOption['data']>[number];
const NULL_LOOKUP_KEY = Symbol('candlestick-null');

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getOwnValue<T extends object>(
  object: T,
  key: string,
): T[keyof T] | undefined {
  return key && Object.hasOwn(object, key) ? object[key as keyof T] : undefined;
}

function toLookupKey(value: unknown): LookupKey {
  return value == null ? NULL_LOOKUP_KEY : String(value);
}

function getOhlc(
  datum: DataRecord,
  openLabel: string,
  closeLabel: string,
  lowLabel: string,
  highLabel: string,
): OhlcValue | null {
  const open = toNumber(getOwnValue(datum, openLabel));
  const close = toNumber(getOwnValue(datum, closeLabel));
  const low = toNumber(getOwnValue(datum, lowLabel));
  const high = toNumber(getOwnValue(datum, highLabel));
  if (open === null || close === null || low === null || high === null) {
    return null;
  }
  return [open, close, low, high];
}

function toCandlestickDatum(
  datum: DataRecord | undefined,
  openLabel: string,
  closeLabel: string,
  lowLabel: string,
  highLabel: string,
): CandlestickDatum {
  if (!datum) {
    return [];
  }
  return getOhlc(datum, openLabel, closeLabel, lowLabel, highLabel) ?? [];
}

function extractOhlc(value: unknown): OhlcValue | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const raw = value.length >= 5 ? value.slice(1, 5) : value.slice(0, 4);
  if (raw.length !== 4) {
    return null;
  }
  const [open, close, low, high] = raw.map(item => Number(item));
  if ([open, close, low, high].some(item => !Number.isFinite(item))) {
    return null;
  }
  return [open, close, low, high];
}

function formatTooltip({
  params,
  numberFormatter,
  title,
  increaseLabel,
  decreaseLabel,
}: {
  params: CallbackDataParams[];
  numberFormatter: NumberFormatter | CurrencyFormatter;
  title: string;
  increaseLabel: string;
  decreaseLabel: string;
}) {
  const rows: string[][] = [];
  let heading = title;
  const candle = params.find(item => extractOhlc(item.value ?? item.data));
  if (candle) {
    const ohlc = extractOhlc(candle.value ?? candle.data);
    if (ohlc) {
      const [open, close, low, high] = ohlc;
      const direction = close >= open ? increaseLabel : decreaseLabel;
      heading = title ? `${title} (${direction})` : direction;
      rows.push(
        [OHLC_LABELS.OPEN, numberFormatter(open)],
        [OHLC_LABELS.CLOSE, numberFormatter(close)],
        [OHLC_LABELS.LOW, numberFormatter(low)],
        [OHLC_LABELS.HIGH, numberFormatter(high)],
      );
    }
  }
  params.forEach(item => {
    if (item.seriesType !== 'line') {
      return;
    }
    const value = Number(item.value);
    if (!Number.isFinite(value)) {
      return;
    }
    rows.push([String(item.seriesName ?? ''), numberFormatter(value)]);
  });
  if (!rows.length) {
    return '';
  }
  return tooltipHtml(rows, heading);
}

export default function transformProps(
  chartProps: EchartsCandlestickChartProps,
): CandlestickChartTransformedProps {
  const {
    width,
    height,
    formData: { echartOptions: customEchartOptionsInput, ...rawFormData },
    hooks,
    queriesData,
    inContextMenu,
    theme,
    legendState = {},
  } = chartProps;
  const formData = {
    ...DEFAULT_FORM_DATA,
    ...rawFormData,
  };
  const [queryData] = queriesData;
  const { data = [] } = queryData;
  const { onLegendStateChanged } = hooks;
  const refs: Refs = {};
  const coltypeMapping = getColtypesMapping(queryData);

  const {
    xAxis,
    open,
    close,
    high,
    low,
    series: seriesControl,
    increaseColor = DEFAULT_INCREASE_COLOR,
    decreaseColor = DEFAULT_DECREASE_COLOR,
    increaseLabel,
    decreaseLabel,
    showXAxis,
    showYAxis,
    xAxisTimeFormat,
    xAxisTitle,
    xAxisTitleMargin,
    xAxisLabelRotation,
    xAxisLabelInterval,
    yAxisTitle,
    yAxisTitleMargin,
    yAxisTitlePosition,
    yAxisFormat,
    currencyFormat,
    tooltipTimeFormat,
    tooltipValuesFormat,
    showLegend,
    legendMargin,
    legendOrientation = LegendOrientation.Top,
    legendType = LegendType.Scroll,
    legendSort,
    zoomable,
    movingAverages,
  } = formData;

  const xAxisName = xAxis ? getColumnLabel(xAxis) : '';
  const seriesColumns = ensureIsArray(seriesControl).map(getColumnLabel);
  const [seriesName] = seriesColumns;
  const openLabel = open ? getMetricLabel(open) : '';
  const closeLabel = close ? getMetricLabel(close) : '';
  const highLabel = high ? getMetricLabel(high) : '';
  const lowLabel = low ? getMetricLabel(low) : '';
  const timeFormatter = getTimeFormatter(tooltipTimeFormat || xAxisTimeFormat);
  const axisTimeFormatter = getTimeFormatter(xAxisTimeFormat);
  const numberFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({
        d3Format: tooltipValuesFormat || yAxisFormat,
        currency: currencyFormat,
      })
    : getNumberFormatter(tooltipValuesFormat || yAxisFormat);
  const yAxisFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({
        d3Format: yAxisFormat,
        currency: currencyFormat,
      })
    : getNumberFormatter(yAxisFormat);

  const increaseHex = rgbToHex(
    increaseColor.r,
    increaseColor.g,
    increaseColor.b,
  );
  const decreaseHex = rgbToHex(
    decreaseColor.r,
    decreaseColor.g,
    decreaseColor.b,
  );
  const upLabel = increaseLabel || DIRECTION_LABELS.INCREASE;
  const downLabel = decreaseLabel || DIRECTION_LABELS.DECREASE;

  const xKeys: LookupKey[] = [];
  const xLabels: string[] = [];
  const xRecords: DataRecord[] = [];
  const xKeySet = new Set<LookupKey>();
  data.forEach(datum => {
    const key = toLookupKey(getOwnValue(datum, xAxisName));
    if (xKeySet.has(key)) {
      return;
    }
    xKeySet.add(key);
    xKeys.push(key);
    xRecords.push(datum);
    xLabels.push(
      getOwnValue(coltypeMapping, xAxisName) === GenericDataType.Temporal
        ? extractGroupbyLabel({
            datum,
            groupby: [xAxisName],
            coltypeMapping,
            timeFormatter: axisTimeFormatter,
          })
        : extractGroupbyLabel({
            datum,
            groupby: [xAxisName],
            coltypeMapping,
          }),
    );
  });

  const seriesKeys: LookupKey[] = [];
  const seriesNames: string[] = [];
  if (seriesName) {
    const seriesKeySet = new Set<LookupKey>();
    data.forEach(datum => {
      const key = toLookupKey(getOwnValue(datum, seriesName));
      if (seriesKeySet.has(key)) {
        return;
      }
      seriesKeySet.add(key);
      seriesKeys.push(key);
      seriesNames.push(
        extractGroupbyLabel({
          datum,
          groupby: [seriesName],
          coltypeMapping,
        }),
      );
    });
  } else {
    seriesKeys.push(CANDLESTICK_SERIES_NAME);
    seriesNames.push(CANDLESTICK_SERIES_NAME);
  }

  const recordsBySeriesAndX = new Map<LookupKey, Map<LookupKey, DataRecord>>();
  data.forEach(datum => {
    const xKey = toLookupKey(getOwnValue(datum, xAxisName));
    const seriesKey = seriesName
      ? toLookupKey(getOwnValue(datum, seriesName))
      : CANDLESTICK_SERIES_NAME;
    let byX = recordsBySeriesAndX.get(seriesKey);
    if (!byX) {
      byX = new Map();
      recordsBySeriesAndX.set(seriesKey, byX);
    }
    byX.set(xKey, datum);
  });

  const candlestickSeries: CandlestickSeriesOption[] = seriesKeys.map(
    (key, index) => ({
      name: seriesNames[index],
      type: 'candlestick',
      data: xKeys.map(xKey =>
        toCandlestickDatum(
          recordsBySeriesAndX.get(key)?.get(xKey),
          openLabel,
          closeLabel,
          lowLabel,
          highLabel,
        ),
      ),
      itemStyle: {
        color: increaseHex,
        color0: decreaseHex,
        borderColor: increaseHex,
        borderColor0: decreaseHex,
      },
    }),
  );

  const periods = parseMovingAveragePeriods(movingAverages);
  const qualifyMaNames = seriesNames.length > 1;
  const movingAverageSeries: LineSeriesOption[] = candlestickSeries.flatMap(
    candle => {
      const closes = (candle.data ?? []).map(item =>
        Array.isArray(item) && Number.isFinite(Number(item[1]))
          ? Number(item[1])
          : null,
      );
      const seriesLabel = qualifyMaNames ? String(candle.name) : undefined;
      return periods.map(period => ({
        name: movingAverageName(period, seriesLabel),
        type: 'line' as const,
        data: calculateMA(closes, period),
        smooth: true,
        showSymbol: false,
        lineStyle: {
          opacity: MA_LINE_OPACITY,
        },
      }));
    },
  );

  const legendData = [
    ...seriesNames,
    ...movingAverageSeries.map(series => String(series.name)),
  ].sort((a, b) => {
    if (!legendSort) {
      return 0;
    }
    return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  });

  const { effectiveLegendMargin, effectiveLegendType } = resolveLegendLayout({
    chartHeight: height,
    chartWidth: width,
    legendItems: legendData,
    legendMargin,
    orientation: legendOrientation,
    show: showLegend,
    theme,
    type: legendType,
  });
  const legendPadding = getChartPadding(
    showLegend,
    legendOrientation,
    effectiveLegendMargin,
  );

  const dataZoom = zoomable
    ? [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          bottom: TIMESERIES_CONSTANTS.zoomBottom,
        },
      ]
    : [];

  const echartOptions: EChartsCoreOption = {
    grid: {
      ...defaultGrid,
      top: theme.sizeUnit * 5 + legendPadding.top,
      bottom:
        theme.sizeUnit * (showXAxis ? 5 : 3) +
        legendPadding.bottom +
        convertInteger(xAxisTitleMargin) +
        (zoomable ? TIMESERIES_CONSTANTS.gridOffsetBottomZoomable : 0),
      left:
        theme.sizeUnit * (showYAxis ? 5 : 2) +
        legendPadding.left +
        convertInteger(yAxisTitleMargin),
      right: theme.sizeUnit * 5 + legendPadding.right,
    },
    legend: {
      ...getLegendProps(
        effectiveLegendType,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
        legendState,
      ),
      data: legendData,
    },
    xAxis: {
      show: showXAxis,
      type: AxisType.Category,
      data: xLabels,
      name: xAxisTitle,
      nameGap: convertInteger(xAxisTitleMargin),
      nameLocation: 'middle',
      axisLabel: {
        rotate: xAxisLabelRotation,
        interval: xAxisLabelInterval === 'auto' ? 'auto' : 0,
        hideOverlap: true,
      },
    },
    yAxis: {
      ...defaultYAxis,
      show: showYAxis,
      type: AxisType.Value,
      name: yAxisTitle,
      nameGap: convertInteger(yAxisTitleMargin),
      nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
      axisLabel: { formatter: yAxisFormatter },
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      trigger: 'item',
      axisPointer: { type: 'shadow' },
      show: !inContextMenu,
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const [item] = ensureIsArray(params);
        if (!item) {
          return '';
        }
        const categoryIndex = item.dataIndex;
        const categoryDatum =
          Number.isInteger(categoryIndex) &&
          categoryIndex >= 0 &&
          categoryIndex < xRecords.length
            ? xRecords[categoryIndex]
            : {};
        const categoryLabel = Number.isInteger(categoryIndex)
          ? xLabels[categoryIndex]
          : undefined;
        const title =
          getOwnValue(coltypeMapping, xAxisName) === GenericDataType.Temporal
            ? extractGroupbyLabel({
                datum: categoryDatum,
                groupby: [xAxisName],
                coltypeMapping,
                timeFormatter,
              })
            : String(item.name ?? categoryLabel ?? '');
        return formatTooltip({
          params: ensureIsArray(params) as CallbackDataParams[],
          numberFormatter,
          title,
          increaseLabel: upLabel,
          decreaseLabel: downLabel,
        });
      },
    },
    series: [...candlestickSeries, ...movingAverageSeries],
    toolbox: {
      show: zoomable,
      feature: {
        dataZoom: {
          yAxisIndex: false,
          title: {
            zoom: 'zoom area',
            back: 'restore zoom',
          },
        },
      },
    },
    dataZoom,
  };

  let customEchartOptions;
  try {
    customEchartOptions = safeParseEChartOptions(customEchartOptionsInput);
  } catch (_) {
    customEchartOptions = undefined;
  }
  const mergedEchartOptions = customEchartOptions
    ? mergeCustomEChartOptions(echartOptions, customEchartOptions)
    : echartOptions;

  return {
    formData,
    width,
    height,
    echartOptions: mergedEchartOptions,
    onLegendStateChanged,
    refs,
    coltypeMapping,
  };
}
