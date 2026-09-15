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
  AnnotationData,
  AnnotationOpacity,
  AxisType,
  CategoricalColorScale,
  EventAnnotationLayer,
  FilterState,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  LegendState,
  TimeseriesAnnotationLayer,
  TimeseriesDataRecord,
  ValueFormatter,
} from '@superset-ui/core';
import { SupersetTheme, isThemeDark } from '@apache-superset/core/theme';
import type {
  CallbackDataParams,
  DefaultStatesMixin,
  ItemStyleOption,
  LabelLayoutOption,
  LabelLayoutOptionCallback,
  LabelLayoutOptionCallbackParams,
  LineStyleOption,
  OptionName,
  SeriesLabelOption,
  SeriesLineLabelOption,
  ZRLineType,
} from 'echarts/types/src/util/types';
import type { SeriesOption } from 'echarts';
import type {
  MarkArea1DDataItemOption,
  MarkArea2DDataItemOption,
} from 'echarts/types/src/component/marker/MarkAreaModel';
import type { MarkLine1DDataItemOption } from 'echarts/types/src/component/marker/MarkLineModel';
import { extractForecastSeriesContext } from '../utils/forecast';
import {
  BarValueLabelPosition,
  EchartsTimeseriesSeriesType,
  ForecastSeriesEnum,
  LabelPositionEnum,
  LegendOrientation,
  OrientationType,
  StackType,
} from '../types';

import {
  evalFormula,
  extractRecordAnnotations,
  formatAnnotationLabel,
  parseAnnotationOpacity,
} from '../utils/annotation';
import { getChartPadding, getTimeCompareStackId } from '../utils/series';
import {
  OpacityEnum,
  StackControlsValue,
  TIMESERIES_CONSTANTS,
} from '../constants';

const AUTO_LABEL_FIT_RATIO = 0.8;
const BAR_LABEL_DISTANCE = 5;
// Neither an inside nor an outside placement gives a stacked segment's value
// label legible, non-overlapping room once the segment's own extent drops
// below roughly the label text's height, since the closest available
// placement then collides with a neighboring segment's label regardless of
// which side it's drawn on. Highcharts and D3 apply the same kind of floor.
// The label font size is theme.fontSizeSM (~12px, see series.ts), so 16px
// covers the glyph height plus a couple of pixels of breathing room.
const MIN_LABEL_SEGMENT_SIZE_PX = 16;
// The labelLayout callback only applies align/verticalAlign/width/height/
// fontSize from its return value (LABEL_OPTION_TO_STYLE_KEYS in ECharts'
// LabelManager) — there is no hide/ignore field, so a zero font size is the
// supported way to suppress an individual label from this callback.
const HIDDEN_LABEL_LAYOUT: LabelLayoutOption = { fontSize: 0 };

type BarLabelPosition =
  | 'bottom'
  | 'inside'
  | 'insideBottom'
  | 'insideLeft'
  | 'insideRight'
  | 'insideTop'
  | 'left'
  | 'right'
  | 'top';

type NegativeBarLabelPosition = BarLabelPosition | 'outside';

/** Resolve the fixed ECharts label position for a bar value. */
function getBarLabelPosition(
  position: BarValueLabelPosition,
  isHorizontal: boolean,
  isNegative = false,
): BarLabelPosition {
  if (position === BarValueLabelPosition.OutsideEnd) {
    if (isHorizontal) return isNegative ? 'left' : 'right';
    return isNegative ? 'bottom' : 'top';
  }
  if (position === BarValueLabelPosition.InsideCenter) return 'inside';
  const isEnd = position !== BarValueLabelPosition.InsideBase;
  const usePositiveEnd = isEnd !== isNegative;
  if (isHorizontal) return usePositiveEnd ? 'insideRight' : 'insideLeft';
  return usePositiveEnd ? 'insideTop' : 'insideBottom';
}

/** Place a horizontal bar label just beyond its value end. */
function getHorizontalOutsideLayout(
  params: LabelLayoutOptionCallbackParams,
  isNegative: boolean,
): LabelLayoutOption {
  return {
    x: isNegative
      ? params.rect.x - BAR_LABEL_DISTANCE
      : params.rect.x + params.rect.width + BAR_LABEL_DISTANCE,
    y: params.rect.y + params.rect.height / 2,
    align: isNegative ? 'right' : 'left',
    verticalAlign: 'middle',
  };
}

/** Place a vertical bar label just beyond its value end. */
function getVerticalOutsideLayout(
  params: LabelLayoutOptionCallbackParams,
  isNegative: boolean,
): LabelLayoutOption {
  return {
    x: params.rect.x + params.rect.width / 2,
    y: isNegative
      ? params.rect.y + params.rect.height + BAR_LABEL_DISTANCE
      : params.rect.y - BAR_LABEL_DISTANCE,
    align: 'center',
    verticalAlign: isNegative ? 'top' : 'bottom',
  };
}

/** Keep fitting labels inside, move oversized labels outside the bar, and
 * suppress labels for segments too small to legibly fit one either way. */
export function getAutoBarLabelLayout(
  params: LabelLayoutOptionCallbackParams,
  isHorizontal: boolean,
  isNegative = false,
): LabelLayoutOption {
  const segmentSize = isHorizontal
    ? Math.abs(params.rect.width)
    : Math.abs(params.rect.height);
  if (segmentSize < MIN_LABEL_SEGMENT_SIZE_PX) {
    return HIDDEN_LABEL_LAYOUT;
  }
  const fitsWidth =
    params.labelRect.width <=
    Math.abs(params.rect.width) * AUTO_LABEL_FIT_RATIO;
  const fitsHeight =
    params.labelRect.height <=
    Math.abs(params.rect.height) * AUTO_LABEL_FIT_RATIO;
  if (fitsWidth && fitsHeight) return {};
  return isHorizontal
    ? getHorizontalOutsideLayout(params, isNegative)
    : getVerticalOutsideLayout(params, isNegative);
}

function parseTimeShiftToMs(timeShift?: string | null): number {
  if (!timeShift) return 0;

  const match = timeShift
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*(second|minute|hour|day|week|month|year)s?$/i);

  if (!match) return 0;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const MS: Record<string, number> = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };

  return value * (MS[unit] ?? 0);
}

// based on weighted wiggle algorithm
// source: https://ieeexplore.ieee.org/document/4658136
export const getBaselineSeriesForStream = (
  series: [string | number, number][][],
  seriesType: EchartsTimeseriesSeriesType,
) => {
  const seriesLength = series[0].length;
  const baselineSeriesDelta: [string | number, number][] = Array.from(
    { length: seriesLength },
    () => [0, 0],
  );
  const getVal = (value: number | null) => value ?? 0;
  for (let i = 0; i < seriesLength; i += 1) {
    let seriesSum = 0;
    let weightedSeriesSum = 0;
    for (let j = 0; j < series.length; j += 1) {
      const delta =
        i > 0
          ? getVal(series[j][i][1]) - getVal(series[j][i - 1][1])
          : getVal(series[j][i][1]);
      let deltaPrev = 0;
      for (let k = 1; k < j - 1; k += 1) {
        deltaPrev +=
          i > 0
            ? getVal(series[k][i][1]) - getVal(series[k][i - 1][1])
            : getVal(series[k][i][1]);
      }
      weightedSeriesSum += (0.5 * delta + deltaPrev) * getVal(series[j][i][1]);
      seriesSum += getVal(series[j][i][1]);
    }
    baselineSeriesDelta[i] = [series[0][i][0], -weightedSeriesSum / seriesSum];
  }
  const baselineSeries = baselineSeriesDelta.reduce<
    [string | number, number][]
  >((acc, curr, i) => {
    if (i === 0) {
      acc.push(curr);
    } else {
      acc.push([curr[0], acc[i - 1][1] + curr[1]]);
    }
    return acc;
  }, []);
  return {
    data: baselineSeries,
    name: 'baseline',
    stack: 'obs',
    stackStrategy: 'all' as const,
    type: 'line' as const,
    lineStyle: {
      opacity: 0,
    },
    tooltip: {
      show: false,
    },
    silent: true,
    showSymbol: false,
    areaStyle: {
      opacity: 0,
    },
    step: [
      EchartsTimeseriesSeriesType.Start,
      EchartsTimeseriesSeriesType.Middle,
      EchartsTimeseriesSeriesType.End,
    ].includes(seriesType)
      ? (seriesType as
          | EchartsTimeseriesSeriesType.Start
          | EchartsTimeseriesSeriesType.Middle
          | EchartsTimeseriesSeriesType.End)
      : undefined,
    smooth: seriesType === EchartsTimeseriesSeriesType.Smooth,
  };
};

/** Identify object-form ECharts data items. */
function isDataItemObject(
  dataItem: unknown,
): dataItem is Record<string, unknown> {
  return (
    typeof dataItem === 'object' &&
    dataItem !== null &&
    !Array.isArray(dataItem)
  );
}

/** Return whether an ECharts bar datum is negative on its value axis. */
function isNegativeBarDataItem(
  dataItem: unknown,
  isHorizontal: boolean,
): boolean {
  const value = isDataItemObject(dataItem) ? dataItem.value : dataItem;
  const axisValue = Array.isArray(value)
    ? value[isHorizontal ? 0 : 1]
    : undefined;
  return typeof axisValue === 'number' && axisValue < 0;
}

/** Create a fit-aware layout callback bound to one bar series. */
function createAutoBarLabelLayout(
  data: unknown,
  isHorizontal: boolean,
): LabelLayoutOptionCallback {
  return params => {
    const dataItem =
      Array.isArray(data) && params.dataIndex !== undefined
        ? data[params.dataIndex]
        : undefined;
    return getAutoBarLabelLayout(
      params,
      isHorizontal,
      isNegativeBarDataItem(dataItem, isHorizontal),
    );
  };
}

/** Apply the value-end label position to a negative bar datum. */
function transformNegativeLabel(
  dataItem: unknown,
  isHorizontal: boolean,
  negativePosition: NegativeBarLabelPosition,
): unknown {
  if (!isNegativeBarDataItem(dataItem, isHorizontal)) return dataItem;
  const value = isDataItemObject(dataItem) ? dataItem.value : dataItem;
  const item = isDataItemObject(dataItem) ? dataItem : { value };
  const label = isDataItemObject(item.label) ? item.label : {};
  return { ...item, label: { ...label, position: negativePosition } };
}

/** Adjust label positions for negative values in a bar series. */
export function transformNegativeLabelsPosition(
  series: SeriesOption,
  isHorizontal: boolean,
  negativePosition: NegativeBarLabelPosition = 'outside',
): TimeseriesDataRecord[] {
  return (series.data as unknown[]).map(dataItem =>
    transformNegativeLabel(dataItem, isHorizontal, negativePosition),
  ) as TimeseriesDataRecord[];
}

export function applyColorByPrimaryAxis(
  series: SeriesOption,
  colorScale: CategoricalColorScale,
  sliceId: number | undefined,
  opacity: number,
  isHorizontal = false,
): {
  value: [string | number, number];
  itemStyle: { color: string; opacity: number; borderWidth: number };
}[] {
  return (series.data as [string | number, number][]).map(value => {
    // For horizontal charts the primary axis is index 1 (category), not index 0 (numeric)
    const colorKey = String(isHorizontal ? value[1] : value[0]);

    return {
      value,
      itemStyle: {
        color: colorScale(colorKey, sliceId),
        opacity,
        borderWidth: 0,
      },
    };
  });
}

export function transformSeries(
  series: SeriesOption,
  colorScale: CategoricalColorScale,
  colorScaleKey: string,
  opts: {
    area?: boolean;
    connectNulls?: boolean;
    filterState?: FilterState;
    seriesContexts?: { [key: string]: ForecastSeriesEnum[] };
    markerEnabled?: boolean;
    markerSize?: number;
    symbolSizeFn?: (value: (number | string | null)[]) => number;
    areaOpacity?: number;
    seriesType?: EchartsTimeseriesSeriesType;
    stack?: StackType;
    stackIdSuffix?: string;
    yAxisIndex?: number;
    showValue?: boolean;
    valueLabelPosition?: BarValueLabelPosition;
    onlyTotal?: boolean;
    legendState?: LegendState;
    formatter?: ValueFormatter;
    totalStackedValues?: number[];
    showValueIndexes?: number[];
    thresholdValues?: number[];
    richTooltip?: boolean;
    seriesKey?: OptionName;
    sliceId?: number;
    isHorizontal?: boolean;
    lineSymbol?: string;
    lineStyle?: LineStyleOption;
    queryIndex?: number;
    timeCompare?: string[];
    timeShiftColor?: boolean;
    theme?: SupersetTheme;
    hasDimensions?: boolean;
    colorByPrimaryAxis?: boolean;
    labelPosition?: string;
  },
): SeriesOption | undefined {
  const { name, data } = series;
  const {
    area,
    connectNulls,
    filterState,
    seriesContexts = {},
    markerEnabled,
    markerSize,
    symbolSizeFn,
    areaOpacity = 1,
    seriesType,
    stack,
    stackIdSuffix,
    yAxisIndex = 0,
    showValue,
    valueLabelPosition = BarValueLabelPosition.Auto,
    onlyTotal,
    formatter,
    legendState,
    totalStackedValues = [],
    showValueIndexes = [],
    thresholdValues = [],
    richTooltip,
    seriesKey,
    sliceId,
    isHorizontal = false,
    queryIndex = 0,
    timeCompare = [],
    timeShiftColor,
    theme,
    colorByPrimaryAxis = false,
    labelPosition,
  } = opts;
  const contexts = seriesContexts[name || ''] || [];
  const hasForecast =
    contexts.includes(ForecastSeriesEnum.ForecastTrend) ||
    contexts.includes(ForecastSeriesEnum.ForecastLower) ||
    contexts.includes(ForecastSeriesEnum.ForecastUpper);

  const forecastSeries = extractForecastSeriesContext(name || '');
  const isConfidenceBand =
    forecastSeries.type === ForecastSeriesEnum.ForecastLower ||
    forecastSeries.type === ForecastSeriesEnum.ForecastUpper;
  // When cross-filtering by X-axis (no dimensions), selectedValues contains
  // X-axis values rather than series names, so skip series-level dimming.
  const isFiltered =
    opts.hasDimensions !== false &&
    filterState?.selectedValues &&
    !filterState?.selectedValues.includes(name);
  const opacity = isFiltered
    ? OpacityEnum.SemiTransparent
    : opts.lineStyle?.opacity || OpacityEnum.NonTransparent;

  // don't create a series if doing a stack or area chart and the result
  // is a confidence band
  if ((stack || area) && isConfidenceBand) return undefined;

  const isObservation = forecastSeries.type === ForecastSeriesEnum.Observation;
  const isTrend = forecastSeries.type === ForecastSeriesEnum.ForecastTrend;
  let stackId;
  if (isConfidenceBand) {
    stackId = forecastSeries.name;
  } else if (stack && isObservation) {
    // the suffix of the observation series is '' (falsy), which disables
    // stacking. Therefore, we need to set something that is truthy.
    stackId = getTimeCompareStackId('obs', timeCompare, name);
  } else if (stack && isTrend) {
    stackId = getTimeCompareStackId(forecastSeries.type, timeCompare, name);
  }
  if (stackId && stackIdSuffix) {
    stackId += stackIdSuffix;
  }
  let plotType;
  if (
    !isConfidenceBand &&
    (seriesType === 'scatter' || (hasForecast && isObservation))
  ) {
    plotType = 'scatter';
  } else if (isConfidenceBand) {
    plotType = 'line';
  } else {
    plotType = seriesType === 'bar' ? 'bar' : 'line';
  }

  const isDarkMode = theme ? isThemeDark(theme) : false;

  /**
   * if timeShiftColor is enabled the colorScaleKey forces the color to be the
   * same as the original series, otherwise uses separate colors
   * */
  const itemStyle: ItemStyleOption = {
    color: timeShiftColor
      ? colorScale(colorScaleKey, sliceId)
      : colorScale(seriesKey || forecastSeries.name, sliceId),
    opacity,
    borderWidth: 0,
  };
  if (seriesType === 'bar' && connectNulls) {
    itemStyle.borderWidth = 1.5;
    itemStyle.borderType = 'dotted';
    itemStyle.borderColor = itemStyle.color;
  }
  let emphasis = {};
  let showSymbol = false;
  if (!isConfidenceBand) {
    if (plotType === 'scatter') {
      showSymbol = true;
    } else if (hasForecast && isObservation) {
      showSymbol = true;
    } else if (plotType === 'line' && showValue) {
      showSymbol = true;
    } else if (plotType === 'line' && !richTooltip && !markerEnabled) {
      // this is hack to make timeseries line chart clickable when tooltip trigger is 'item'
      // so that the chart can emit cross-filtering
      showSymbol = true;
      itemStyle.opacity = 0;
      emphasis = {
        itemStyle: {
          opacity: 1,
        },
      };
    } else if (markerEnabled) {
      showSymbol = true;
    }
  }
  const lineStyle =
    isConfidenceBand || (stack === StackControlsValue.Stream && area)
      ? { ...opts.lineStyle, opacity: OpacityEnum.Transparent }
      : { ...opts.lineStyle, opacity };

  // Use filled circles in dark mode to avoid the white fill issue with hollow circles
  // Use emptyCircle explicitly in light mode
  let symbol;
  if (plotType === 'line') {
    symbol = opts.lineSymbol || (isDarkMode ? 'circle' : 'emptyCircle');
  }

  let transformedData = data;
  if (Array.isArray(data) && colorByPrimaryAxis) {
    transformedData = applyColorByPrimaryAxis(
      series,
      colorScale,
      sliceId,
      opacity,
      isHorizontal,
    );
  }
  if (Array.isArray(transformedData) && plotType === 'bar') {
    // An explicit labelPosition (set before valueLabelPosition existed, or
    // still relevant to a saved chart) takes precedence for negative values;
    // otherwise fall back to the fit-aware valueLabelPosition-derived spot.
    const negativeLabelPosition: NegativeBarLabelPosition =
      labelPosition && labelPosition !== 'auto'
        ? (labelPosition as NegativeBarLabelPosition)
        : getBarLabelPosition(valueLabelPosition, isHorizontal, true);
    transformedData = transformNegativeLabelsPosition(
      { ...series, data: transformedData },
      isHorizontal,
      negativeLabelPosition,
    );
  }

  const isAutoBarLabel =
    plotType === 'bar' && valueLabelPosition === BarValueLabelPosition.Auto;
  const isInsideBarLabel =
    plotType === 'bar' &&
    valueLabelPosition !== BarValueLabelPosition.OutsideEnd;

  return {
    ...series,
    ...(Array.isArray(data) ? { data: transformedData } : null),
    connectNulls,
    queryIndex,
    yAxisIndex,
    name: forecastSeries.name,
    ...(colorByPrimaryAxis ? {} : { itemStyle }),
    // @ts-ignore
    type: plotType,
    // Cap bar width so a single data point doesn't stretch across the
    // entire chart area. Bars with many categories auto-size below this cap.
    ...(plotType === 'bar' ? { barMaxWidth: 100 } : {}),
    smooth: seriesType === 'smooth',
    triggerLineEvent: true,
    // @ts-expect-error
    step: ['start', 'middle', 'end'].includes(seriesType as string)
      ? seriesType
      : undefined,
    stack: stackId,
    stackStrategy:
      isConfidenceBand || stack === StackControlsValue.Stream
        ? 'all'
        : 'samesign',
    lineStyle,
    areaStyle:
      area || forecastSeries.type === ForecastSeriesEnum.ForecastUpper
        ? {
            opacity: opacity * areaOpacity,
          }
        : undefined,
    emphasis,
    showSymbol,
    symbol,
    symbolSize: symbolSizeFn ?? markerSize,
    ...(isAutoBarLabel
      ? {
          labelLayout: createAutoBarLabelLayout(transformedData, isHorizontal),
        }
      : {}),
    label: {
      show: !!showValue,
      // An explicit labelPosition (the generic control still used by
      // MixedTimeseries' bar series, and by standalone bar charts saved
      // before valueLabelPosition existed) wins outright. Otherwise bar
      // charts fall back to the fit-aware valueLabelPosition control, and
      // every other "Show value" chart type falls back to an
      // orientation-aware default.
      position:
        labelPosition && labelPosition !== 'auto'
          ? (labelPosition as LabelPositionEnum)
          : plotType === 'bar'
            ? getBarLabelPosition(valueLabelPosition, isHorizontal)
            : isHorizontal
              ? LabelPositionEnum.Right
              : LabelPositionEnum.Top,
      // ECharts derives contrast from the bar fill for inside positions.
      // Auto x/y overflow clears the position, selecting its outside fill.
      ...(isInsideBarLabel ? {} : { color: theme?.colorText }),
      ...(plotType === 'bar' ? { overflow: 'truncate' } : {}),
      textBorderWidth: 0,
      formatter: (params: any) => {
        // don't show confidence band value labels, as they're already visible on the tooltip
        if (
          [
            ForecastSeriesEnum.ForecastUpper,
            ForecastSeriesEnum.ForecastLower,
          ].includes(forecastSeries.type)
        ) {
          return '';
        }
        const { value, dataIndex, seriesIndex, seriesName } = params;
        const numericValue = isHorizontal ? value[0] : value[1];
        const isSelectedLegend = !legendState || legendState[seriesName];
        const isAreaExpand = stack === StackControlsValue.Expand;
        if (!formatter) {
          return numericValue;
        }
        if (!stack && isSelectedLegend) {
          return formatter(numericValue);
        }
        if (!onlyTotal) {
          // A stacked segment with no height begins and ends at the same
          // coordinate as the top of the segment beneath it, so its label is
          // drawn over that segment's label. Zero and null have no height, so
          // they carry no label. The rich tooltip omits zero observations from
          // a stacked series for the same reason.
          if (stack && !numericValue) {
            return '';
          }
          if (
            numericValue >=
            (thresholdValues[dataIndex] || Number.MIN_SAFE_INTEGER)
          ) {
            return formatter(numericValue);
          }
          return '';
        }
        if (seriesIndex === showValueIndexes[dataIndex]) {
          return formatter(isAreaExpand ? 1 : totalStackedValues[dataIndex]);
        }
        return '';
      },
    },
  };
}

export function transformFormulaAnnotation(
  layer: FormulaAnnotationLayer,
  data: TimeseriesDataRecord[],
  xAxisCol: string,
  xAxisType: AxisType,
  colorScale: CategoricalColorScale,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption {
  const { name, color, opacity, width, style } = layer;
  const isHorizontal = orientation === OrientationType.Horizontal;

  return {
    name,
    id: name,
    z: 10,
    itemStyle: {
      color: color || colorScale(name, sliceId),
    },
    lineStyle: {
      opacity: parseAnnotationOpacity(opacity),
      type: style as ZRLineType,
      width,
    },
    type: 'line',
    smooth: true,
    data: evalFormula(layer, data, xAxisCol, xAxisType).map(([x, y]) =>
      isHorizontal ? [y, x] : [x, y],
    ),
    symbolSize: 0,
  };
}

export function transformIntervalAnnotation(
  layer: IntervalAnnotationLayer,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
  theme: SupersetTheme,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  if (annotations.length === 0) {
    return series;
  }

  const { name, color, opacity, showLabel } = layer;
  const isHorizontal = orientation === OrientationType.Horizontal;

  const intervalsByStartTime = new Map<string, string[]>();
  annotations.forEach(annotation => {
    const { descriptions, time = '', title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const existing = intervalsByStartTime.get(time);
    if (existing) {
      existing.push(label);
    } else {
      intervalsByStartTime.set(time, [label]);
    }
  });

  const allIntervalData: (
    | MarkArea1DDataItemOption
    | MarkArea2DDataItemOption
  )[] = annotations.map(annotation => {
    const { intervalEnd, time = '' } = annotation;
    const combinedLabel = (intervalsByStartTime.get(time) || []).join('\n');
    return [
      {
        name: combinedLabel,
        ...(isHorizontal ? { yAxis: time } : { xAxis: time }),
      },
      isHorizontal ? { yAxis: intervalEnd } : { xAxis: intervalEnd },
    ];
  });

  const intervalLabel: SeriesLabelOption = showLabel
    ? {
        show: true,
        color: theme.colorTextLabel,
        position: 'insideTop',
        verticalAlign: 'top',
        fontWeight: 'bold',
        // @ts-expect-error
        emphasis: {
          position: 'insideTop',
          verticalAlign: 'top',
          backgroundColor: theme.colorPrimaryBgHover,
        },
      }
    : {
        show: false,
        color: theme.colorTextLabel,
        emphasis: {
          fontWeight: 'bold',
          show: true,
          position: 'insideTop',
          verticalAlign: 'top',
          backgroundColor: theme.colorPrimaryBgHover,
        },
      };

  // Push a single series with all intervals in the markArea data
  series.push({
    id: `Interval - ${name}`,
    type: 'line',
    animation: false,
    z: 10,
    markArea: {
      silent: false,
      itemStyle: {
        color: color || colorScale(name, sliceId),
        opacity: parseAnnotationOpacity(opacity || AnnotationOpacity.Medium),
        emphasis: {
          opacity: 0.8,
        },
      } as ItemStyleOption,
      label: intervalLabel,
      data: allIntervalData,
    },
  });

  return series;
}

export function transformEventAnnotation(
  layer: EventAnnotationLayer,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
  theme: SupersetTheme,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  if (annotations.length === 0) {
    return series;
  }

  const { name, color, opacity, style, width, showLabel } = layer;
  const isHorizontal = orientation === OrientationType.Horizontal;

  const eventsByTime = new Map<string, { time: string; labels: string[] }>();
  annotations.forEach(annotation => {
    const { descriptions, time = '', title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const existing = eventsByTime.get(time);

    if (existing) {
      existing.labels.push(label);
    } else {
      eventsByTime.set(time, { time, labels: [label] });
    }
  });

  const allEventData: MarkLine1DDataItemOption[] = Array.from(
    eventsByTime.values(),
  ).map(({ time, labels }) => ({
    name: labels.join('\n'),
    ...(isHorizontal ? { yAxis: time } : { xAxis: time }),
  }));

  const lineStyle: LineStyleOption & DefaultStatesMixin['emphasis'] = {
    width,
    type: style as ZRLineType,
    color: color || colorScale(name, sliceId),
    opacity: parseAnnotationOpacity(opacity),
    emphasis: {
      width: width ? width + 1 : width,
      opacity: 1,
    },
  };

  const eventLabel: SeriesLineLabelOption = showLabel
    ? {
        show: true,
        color: theme.colorTextLabel,
        position: 'insideEndTop',
        fontWeight: 'bold',
        formatter: (params: CallbackDataParams) => params.name,
        // @ts-expect-error
        emphasis: {
          backgroundColor: theme.colorPrimaryBgHover,
        },
      }
    : {
        show: false,
        color: theme.colorTextLabel,
        position: 'insideEndTop',
        emphasis: {
          formatter: (params: CallbackDataParams) => params.name,
          fontWeight: 'bold',
          show: true,
          backgroundColor: theme.colorPrimaryBgHover,
        },
      };

  // Push a single series with all events in the markLine data
  series.push({
    id: `Event - ${name}`,
    type: 'line',
    animation: false,
    z: 10,
    markLine: {
      silent: false,
      symbol: 'none',
      lineStyle,
      label: eventLabel,
      data: allEventData,
    },
  });

  return series;
}

export function transformTimeseriesAnnotation(
  layer: TimeseriesAnnotationLayer,
  markerSize: number,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
  sliceId?: number,
  orientation?: OrientationType,
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const { hideLine, name, opacity, showMarkers, style, width, color } = layer;

  const shiftMs = parseTimeShiftToMs((layer as any)?.overrides?.time_shift);

  const result = annotationData[name];
  const isHorizontal = orientation === OrientationType.Horizontal;
  const { records } = result;
  if (records) {
    const data = records.map(record => {
      const keys = Object.keys(record);

      let x = keys.length > 0 ? record[keys[0]] : 0;
      const y = keys.length > 1 ? record[keys[1]] : 0;

      if (shiftMs !== 0 && x != null) {
        const xMs = typeof x === 'string' ? new Date(x).getTime() : Number(x);

        if (!Number.isNaN(xMs)) {
          x = xMs + shiftMs;
        }
      }

      return isHorizontal
        ? ([y, x] as [number, OptionName])
        : ([x, y] as [OptionName, number]);
    });
    const computedStyle = {
      opacity: parseAnnotationOpacity(opacity),
      type: style as ZRLineType,
      width: hideLine ? 0 : width,
      color: color || colorScale(name, sliceId),
    };
    series.push({
      type: 'line',
      id: name,
      name,
      z: 10,
      data,
      symbolSize: showMarkers ? markerSize : 0,
      itemStyle: computedStyle,
      lineStyle: computedStyle,
    });
  }
  return series;
}

export function getPadding(
  showLegend: boolean,
  legendOrientation: LegendOrientation,
  addYAxisTitleOffset: boolean,
  zoomable: boolean,
  margin?: string | number | null,
  addXAxisTitleOffset?: boolean,
  yAxisTitlePosition?: string,
  yAxisTitleMargin?: number,
  xAxisTitleMargin?: number,
  isHorizontal?: boolean,
): {
  bottom: number;
  left: number;
  right: number;
  top: number;
} {
  const yAxisOffset = addYAxisTitleOffset
    ? TIMESERIES_CONSTANTS.yAxisLabelTopOffset
    : 0;
  const xAxisOffset = addXAxisTitleOffset ? Number(xAxisTitleMargin) || 0 : 0;

  return getChartPadding(
    showLegend,
    legendOrientation,
    margin,
    {
      top:
        yAxisTitlePosition && yAxisTitlePosition === 'Top'
          ? TIMESERIES_CONSTANTS.gridOffsetTop + (Number(yAxisTitleMargin) || 0)
          : yAxisTitlePosition === 'Left'
            ? TIMESERIES_CONSTANTS.gridOffsetTop
            : TIMESERIES_CONSTANTS.gridOffsetTop + yAxisOffset,
      bottom:
        zoomable && !isHorizontal
          ? TIMESERIES_CONSTANTS.gridOffsetBottomZoomable + xAxisOffset
          : TIMESERIES_CONSTANTS.gridOffsetBottom + xAxisOffset,
      left:
        yAxisTitlePosition === 'Left'
          ? TIMESERIES_CONSTANTS.gridOffsetLeft +
            (Number(yAxisTitleMargin) || 0)
          : TIMESERIES_CONSTANTS.gridOffsetLeft,
      right:
        showLegend && legendOrientation === LegendOrientation.Right
          ? 0
          : TIMESERIES_CONSTANTS.gridOffsetRight,
    },
    isHorizontal,
  );
}

const MIN_ECHARTS_GRID_HEIGHT = 1;

export function resolveTimeseriesGridOffset(
  offset: unknown,
  chartHeight: number,
) {
  if (typeof offset === 'number') {
    return Number.isFinite(offset) ? Math.max(offset, 0) : 0;
  }
  if (typeof offset !== 'string') {
    return 0;
  }

  const percentage = offset.match(/^\s*(-?\d+(?:\.\d+)?)%\s*$/);
  const pixels = percentage
    ? (Number(percentage[1]) / 100) * chartHeight
    : Number(offset);
  return Number.isFinite(pixels) ? Math.max(pixels, 0) : 0;
}

export function getViableTimeseriesEchartOptions<Options extends object>(
  options: Options,
  chartHeight: number,
  zoomable: boolean,
): Options {
  const optionWithGrid = options as Options & { grid?: unknown };
  const gridOption = Array.isArray(optionWithGrid.grid)
    ? optionWithGrid.grid[0]
    : optionWithGrid.grid;
  if (!gridOption || typeof gridOption !== 'object') {
    return options;
  }

  const grid = gridOption as Record<string, unknown>;
  const rawTop = resolveTimeseriesGridOffset(grid.top, chartHeight);
  const rawBottom = resolveTimeseriesGridOffset(grid.bottom, chartHeight);
  const isCompact = chartHeight <= TIMESERIES_CONSTANTS.compactChartHeight;
  const requestedTop = isCompact ? Math.min(rawTop, 12) : rawTop;
  const requestedBottom =
    isCompact && !zoomable ? Math.min(rawBottom, 5) : rawBottom;
  // Cap both reservations so even a tiny canvas retains a coordinate region.
  const reservationBudget = Math.max(chartHeight - MIN_ECHARTS_GRID_HEIGHT, 0);
  const top = Math.min(requestedTop, reservationBudget);
  const bottom = Math.min(
    requestedBottom,
    Math.max(reservationBudget - top, 0),
  );
  const mustDisableContainLabel =
    isCompact || requestedTop + requestedBottom > reservationBudget;

  if (
    top === rawTop &&
    bottom === rawBottom &&
    (!mustDisableContainLabel || grid.containLabel === false)
  ) {
    return options;
  }

  const viableGrid = {
    ...grid,
    bottom,
    ...(mustDisableContainLabel ? { containLabel: false } : {}),
    top,
  };

  return {
    ...options,
    grid: Array.isArray(optionWithGrid.grid)
      ? [viableGrid, ...optionWithGrid.grid.slice(1)]
      : viableGrid,
  } as Options;
}
