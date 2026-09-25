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
  CategoricalColorNamespace,
  CurrencyFormatter,
  DataRecord,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  getXAxisLabel,
  NumberFormatter,
  rgbToHex,
  tooltipHtml,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { t } from '@apache-superset/core/translation';
import type { CustomSeriesOption, CustomSeriesRenderItem } from 'echarts';
import type { CandlestickSeriesOption, LineSeriesOption } from 'echarts/charts';
import type { EChartsCoreOption } from 'echarts/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  CandlestickChartTransformedProps,
  EchartsCandlestickChartProps,
  EchartsCandlestickFormData,
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
  OHLC_TICK_WIDTH_RATIO,
} from './constants';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getDefaultTooltip } from '../utils/tooltip';
import {
  extractGroupbyLabel,
  getColtypesMapping,
  getLegendProps,
} from '../utils/series';
import { convertInteger } from '../utils/convertInteger';
import { mergeCustomEChartOptions } from '../utils/mergeCustomEChartOptions';
import { safeParseEChartOptions } from '../utils/safeEChartOptionsParser';
import { TIMESERIES_CONSTANTS } from '../constants';
import { getPadding } from '../Timeseries/transformers';
import { LegendOrientation, LegendType, Refs } from '../types';
import { resolveLegendLayout } from '../utils/legendLayout';
import {
  calculateMA,
  MA_LINE_OPACITY,
  movingAverageName,
  parseMovingAveragePeriods,
} from './utils';

type CandlestickDatum = NonNullable<CandlestickSeriesOption['data']>[number];
type AxisTooltipParams = CallbackDataParams & {
  axisValue?: string | number;
  axisValueLabel?: string;
};
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

function toCandlestickDatum(ohlc: OhlcValue | null): CandlestickDatum {
  return ohlc ?? [];
}

function toOhlcBarDatum(
  ohlc: OhlcValue | null,
  categoryIndex: number,
  color: string,
) {
  if (!ohlc) {
    return [];
  }
  return {
    value: [categoryIndex, ...ohlc],
    itemStyle: {
      color,
    },
  };
}

function getDirectionItemStyle(increaseHex: string, decreaseHex: string) {
  return {
    color: increaseHex,
    color0: decreaseHex,
    borderColor: increaseHex,
    borderColor0: decreaseHex,
  };
}

function getSeriesItemStyle(seriesColor: string, hollowFill: string) {
  return {
    color: seriesColor,
    color0: hollowFill,
    borderColor: seriesColor,
    borderColor0: seriesColor,
  };
}

const renderOhlcItem: CustomSeriesRenderItem = (_params, item) => {
  const x = toNumber(item.value(0));
  const open = toNumber(item.value(1));
  const close = toNumber(item.value(2));
  const low = toNumber(item.value(3));
  const high = toNumber(item.value(4));
  if (
    x === null ||
    open === null ||
    close === null ||
    low === null ||
    high === null
  ) {
    return null;
  }

  const openPoint = item.coord([x, open]);
  const closePoint = item.coord([x, close]);
  const lowPoint = item.coord([x, low]);
  const highPoint = item.coord([x, high]);
  const categorySize = item.size?.([1, 0]);
  const categoryWidth = Array.isArray(categorySize)
    ? categorySize[0]
    : categorySize;
  if (categoryWidth == null || !Number.isFinite(categoryWidth)) {
    return null;
  }
  const halfWidth = categoryWidth * OHLC_TICK_WIDTH_RATIO;
  const style = item.style({
    stroke: item.visual('color'),
  });

  return {
    type: 'group',
    children: [
      {
        type: 'line',
        shape: {
          x1: lowPoint[0],
          y1: lowPoint[1],
          x2: highPoint[0],
          y2: highPoint[1],
        },
        style,
      },
      {
        type: 'line',
        shape: {
          x1: openPoint[0],
          y1: openPoint[1],
          x2: openPoint[0] - halfWidth,
          y2: openPoint[1],
        },
        style,
      },
      {
        type: 'line',
        shape: {
          x1: closePoint[0],
          y1: closePoint[1],
          x2: closePoint[0] + halfWidth,
          y2: closePoint[1],
        },
        style,
      },
    ],
  };
};

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

function extractLineValue(item: CallbackDataParams): number | null {
  const raw = item.value ?? item.data;
  if (Array.isArray(raw)) {
    const y = Number(raw[raw.length - 1]);
    return Number.isFinite(y) ? y : null;
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function appendOhlcRows(
  rows: string[][],
  ohlc: OhlcValue,
  numberFormatter: NumberFormatter | CurrencyFormatter,
) {
  const [open, close, low, high] = ohlc;
  rows.push(
    [OHLC_LABELS.OPEN, numberFormatter(open)],
    [OHLC_LABELS.CLOSE, numberFormatter(close)],
    [OHLC_LABELS.LOW, numberFormatter(low)],
    [OHLC_LABELS.HIGH, numberFormatter(high)],
  );
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
  const candles = params.flatMap(item => {
    const ohlc = extractOhlc(item.value ?? item.data);
    return ohlc ? [{ item, ohlc }] : [];
  });

  candles.forEach(({ item, ohlc }) => {
    const [open, close] = ohlc;
    const direction = close >= open ? increaseLabel : decreaseLabel;
    const seriesLabel = String(item.seriesName ?? '');
    rows.push([seriesLabel ? `${seriesLabel} (${direction})` : direction]);
    appendOhlcRows(rows, ohlc, numberFormatter);
  });

  params.forEach(item => {
    if (item.seriesType !== 'line') {
      return;
    }
    const value = extractLineValue(item);
    if (value === null) {
      return;
    }
    rows.push([String(item.seriesName ?? ''), numberFormatter(value)]);
  });
  if (!rows.length) {
    return '';
  }
  return tooltipHtml(rows, title);
}

export default function transformProps(
  chartProps: EchartsCandlestickChartProps,
): CandlestickChartTransformedProps {
  const {
    width,
    height,
    formData: { echartOptions: _echartOptions, ...formData },
    hooks,
    queriesData,
    inContextMenu,
    theme,
    legendState = {},
  } = chartProps;

  const [queryData] = queriesData;
  const { data = [] } = queryData;
  const { onLegendStateChanged, onContextMenu } = hooks;
  const refs: Refs = {};
  const coltypeMapping = getColtypesMapping(queryData);

  const {
    open,
    close,
    high,
    low,
    series: seriesControl,
    candlestickSeriesName,
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
    seriesStyle,
    colorScheme,
    sliceId,
    colorByDirection,
  }: EchartsCandlestickFormData = { ...DEFAULT_FORM_DATA, ...formData };

  // Matches buildQuery.ts's getXAxisColumn: an unset x_axis with
  // granularity_sqla present still queries DTTM_ALIAS, so the transform must
  // resolve the same column or every row collapses into one empty category.
  const xAxisName = (getXAxisLabel(chartProps.rawFormData) as string) ?? '';
  const seriesColumns = ensureIsArray(seriesControl).map(getColumnLabel);
  const [seriesName] = seriesColumns;
  const defaultSeriesLabel =
    candlestickSeriesName?.trim() || CANDLESTICK_SERIES_NAME;
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
  const colorScale = CategoricalColorNamespace.getScale(colorScheme);
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
  const seriesRecords: DataRecord[] = [];
  if (seriesName) {
    const seriesKeySet = new Set<LookupKey>();
    data.forEach(datum => {
      const key = toLookupKey(getOwnValue(datum, seriesName));
      if (seriesKeySet.has(key)) {
        return;
      }
      seriesKeySet.add(key);
      seriesKeys.push(key);
      seriesRecords.push(datum);
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
    seriesNames.push(defaultSeriesLabel);
  }

  const useSeriesColors = seriesNames.length > 1 || colorByDirection === false;

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

  const ohlcBySeries: (OhlcValue | null)[][] = seriesKeys.map(key =>
    xKeys.map(xKey => {
      const datum = recordsBySeriesAndX.get(key)?.get(xKey);
      return datum
        ? getOhlc(datum, openLabel, closeLabel, lowLabel, highLabel)
        : null;
    }),
  );

  const priceSeries: (CandlestickSeriesOption | CustomSeriesOption)[] =
    ohlcBySeries.map((ohlcData, index) => {
      const name = seriesNames[index];
      const seriesColor = useSeriesColors
        ? colorScale(name, sliceId)
        : increaseHex;
      if (seriesStyle === 'ohlc') {
        return {
          name,
          type: 'custom',
          renderItem: renderOhlcItem,
          dimensions: ['-', 'open', 'close', 'low', 'high'],
          encode: {
            x: 0,
            y: [1, 2, 3, 4],
            tooltip: [1, 2, 3, 4],
          },
          itemStyle: {
            color: seriesColor,
          },
          data: ohlcData.map((ohlc, categoryIndex) => {
            if (!ohlc) {
              return [];
            }
            const [openValue, closeValue] = ohlc;
            const color = useSeriesColors
              ? seriesColor
              : closeValue >= openValue
                ? increaseHex
                : decreaseHex;
            return toOhlcBarDatum(ohlc, categoryIndex, color);
          }),
        };
      }
      return {
        name,
        type: 'candlestick',
        data: ohlcData.map(toCandlestickDatum),
        itemStyle: useSeriesColors
          ? getSeriesItemStyle(seriesColor, theme.colorBgContainer)
          : getDirectionItemStyle(increaseHex, decreaseHex),
      };
    });

  const periods = parseMovingAveragePeriods(movingAverages);
  const qualifyMaNames = seriesNames.length > 1;
  const movingAverageSeries: LineSeriesOption[] = ohlcBySeries.flatMap(
    (ohlcData, index) => {
      // Compute the average over only this series' own trading dates, not the
      // union of every series' dates: xKeys/ohlcData are padded with null for
      // dates a *different* series contributed, and calculateMA blanks a whole
      // window on a single null, so padding here would put gaps in this
      // series' MA line caused by another series' calendar.
      const ownIndices: number[] = [];
      const closes: number[] = [];
      ohlcData.forEach((ohlc, xIndex) => {
        if (ohlc) {
          ownIndices.push(xIndex);
          closes.push(ohlc[1]);
        }
      });
      const seriesLabel = qualifyMaNames ? seriesNames[index] : undefined;
      return periods.map(period => {
        const name = movingAverageName(period, seriesLabel);
        const maColor = colorScale(name, sliceId);
        const maValues = calculateMA(closes, period);
        // Scatter the compact result back onto the shared category axis so
        // it still lines up with the candles; a date this series has no
        // candle for stays a genuine gap in the MA line.
        const data: (number | '-' | null)[] = Array.from(
          { length: xKeys.length },
          () => null,
        );
        ownIndices.forEach((xIndex, i) => {
          data[xIndex] = maValues[i];
        });
        return {
          name,
          type: 'line' as const,
          data,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: maColor },
          lineStyle: {
            opacity: MA_LINE_OPACITY,
            color: maColor,
          },
        };
      });
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

  const xAxisTitleMarginPx = convertInteger(xAxisTitleMargin);
  const yAxisTitleMarginPx = convertInteger(yAxisTitleMargin);
  const addXAxisTitleOffset =
    Boolean(showXAxis && xAxisTitle) && xAxisTitleMarginPx !== 0;
  const addYAxisTitleOffset =
    Boolean(showYAxis && yAxisTitle) && yAxisTitleMarginPx !== 0;
  const chartPadding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisTitleOffset,
    zoomable,
    effectiveLegendMargin,
    addXAxisTitleOffset,
    yAxisTitlePosition,
    addYAxisTitleOffset ? yAxisTitleMarginPx : 0,
    addXAxisTitleOffset ? xAxisTitleMarginPx : 0,
  );

  const echartOptions: EChartsCoreOption = {
    grid: {
      ...defaultGrid,
      ...chartPadding,
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
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      show: !inContextMenu,
      formatter: (params: CallbackDataParams | CallbackDataParams[]) => {
        const items = ensureIsArray(params) as AxisTooltipParams[];
        const [item] = items;
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
            : String(
                item.axisValueLabel ??
                  item.axisValue ??
                  item.name ??
                  categoryLabel ??
                  '',
              );
        return formatTooltip({
          params: items,
          numberFormatter,
          title,
          increaseLabel: upLabel,
          decreaseLabel: downLabel,
        });
      },
    },
    series: [...priceSeries, ...movingAverageSeries],
    toolbox: {
      show: zoomable,
      feature: {
        dataZoom: {
          yAxisIndex: false,
          title: {
            zoom: t('zoom area'),
            back: t('restore zoom'),
          },
        },
      },
    },
    dataZoom,
  };

  let customEchartOptions;
  try {
    customEchartOptions = safeParseEChartOptions(_echartOptions);
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
    onContextMenu,
    refs,
    coltypeMapping,
    xAxisColumn: xAxisName,
    seriesColumn: seriesName,
    xValues: xRecords.map(datum => getOwnValue(datum, xAxisName)),
    xLabels,
    seriesValues: seriesName
      ? seriesNames.map((name, index) => ({
          name,
          // The raw datum value, not the stringified lookup key: a numeric or
          // boolean series column must keep its type so the drill-to-detail
          // filter this feeds (superset/models/helpers.py's EQUALS handling)
          // doesn't compare a column to the wrong SQL literal type.
          value: getOwnValue(seriesRecords[index], seriesName) ?? null,
        }))
      : [],
  };
}
