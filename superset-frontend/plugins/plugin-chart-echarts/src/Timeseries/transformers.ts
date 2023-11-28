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
  isTimeseriesAnnotationResult,
  LegendState,
  SupersetTheme,
  TimeseriesAnnotationLayer,
  TimeseriesDataRecord,
  ValueFormatter,
} from '@superset-ui/core';
import { SeriesOption } from 'echarts';
import {
  CallbackDataParams,
  DefaultStatesMixin,
  ItemStyleOption,
  LineStyleOption,
  OptionName,
  SeriesLabelOption,
  SeriesLineLabelOption,
  ZRLineType,
} from 'echarts/types/src/util/types';
import {
  MarkArea1DDataItemOption,
  MarkArea2DDataItemOption,
} from 'echarts/types/src/component/marker/MarkAreaModel';
import { MarkLine1DDataItemOption } from 'echarts/types/src/component/marker/MarkLineModel';
import { extractForecastSeriesContext } from '../utils/forecast';
import {
  EchartsTimeseriesSeriesType,
  ForecastSeriesEnum,
  LegendOrientation,
  StackType,
} from '../types';

import {
  evalFormula,
  extractRecordAnnotations,
  formatAnnotationLabel,
  parseAnnotationOpacity,
} from '../utils/annotation';
import { getChartPadding } from '../utils/series';
import {
  OpacityEnum,
  StackControlsValue,
  TIMESERIES_CONSTANTS,
} from '../constants';

// based on weighted wiggle algorithm
// source: https://ieeexplore.ieee.org/document/4658136
export const getBaselineSeriesForStream = (
  series: [string | number, number][][],
  seriesType: EchartsTimeseriesSeriesType,
) => {
  const seriesLength = series[0].length;
  const baselineSeriesDelta = new Array(seriesLength).fill([0, 0]);
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
  const baselineSeries = baselineSeriesDelta.reduce((acc, curr, i) => {
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

export function transformSeries(
  series: SeriesOption,
  colorScale: CategoricalColorScale,
  colorScaleKey: string,
  opts: {
    area?: boolean;
    filterState?: FilterState;
    seriesContexts?: { [key: string]: ForecastSeriesEnum[] };
    markerEnabled?: boolean;
    markerSize?: number;
    areaOpacity?: number;
    seriesType?: EchartsTimeseriesSeriesType;
    stack?: StackType;
    yAxisIndex?: number;
    showValue?: boolean;
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
    lineStyle?: LineStyleOption;
    queryIndex?: number;
  },
): SeriesOption | undefined {
  const { name } = series;
  const {
    area,
    filterState,
    seriesContexts = {},
    markerEnabled,
    markerSize,
    areaOpacity = 1,
    seriesType,
    stack,
    yAxisIndex = 0,
    showValue,
    onlyTotal,
    formatter,
    legendState,
    totalStackedValues = [],
    showValueIndexes = [],
    thresholdValues = [],
    richTooltip,
    sliceId,
    isHorizontal = false,
    queryIndex = 0,
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
  const isFiltered =
    filterState?.selectedValues && !filterState?.selectedValues.includes(name);
  const opacity = isFiltered
    ? OpacityEnum.SemiTransparent
    : OpacityEnum.NonTransparent;

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
    // stacking. Therefore we need to set something that is truthy.
    stackId = 'obs';
  } else if (stack && isTrend) {
    stackId = forecastSeries.type;
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
  // forcing the colorScale to return a different color for same metrics across different queries
  const itemStyle = {
    color: colorScale(colorScaleKey, sliceId),
    opacity,
  };
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
  return {
    ...series,
    queryIndex,
    yAxisIndex,
    name: forecastSeries.name,
    itemStyle,
    // @ts-ignore
    type: plotType,
    smooth: seriesType === 'smooth',
    triggerLineEvent: true,
    // @ts-ignore
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
    emphasis: {
      // bold on hover as required since 5.3.0 to retain backwards feature parity:
      // https://apache.github.io/echarts-handbook/en/basics/release-note/5-3-0/#removing-the-default-bolding-emphasis-effect-in-the-line-chart
      // TODO: should consider only adding emphasis to currently hovered series
      lineStyle: {
        width: 'bolder',
      },
      ...emphasis,
    },
    showSymbol,
    symbolSize: markerSize,
    label: {
      show: !!showValue,
      position: isHorizontal ? 'right' : 'top',
      formatter: (params: any) => {
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
): SeriesOption {
  const { name, color, opacity, width, style } = layer;
  return {
    name,
    id: name,
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
    data: evalFormula(layer, data, xAxisCol, xAxisType),
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
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  annotations.forEach(annotation => {
    const { name, color, opacity, showLabel } = layer;
    const { descriptions, intervalEnd, time, title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const intervalData: (
      | MarkArea1DDataItemOption
      | MarkArea2DDataItemOption
    )[] = [
      [
        {
          name: label,
          xAxis: time,
        },
        {
          xAxis: intervalEnd,
        },
      ],
    ];
    const intervalLabel: SeriesLabelOption = showLabel
      ? {
          show: true,
          color: theme.colors.grayscale.dark2,
          position: 'insideTop',
          verticalAlign: 'top',
          fontWeight: 'bold',
          // @ts-ignore
          emphasis: {
            position: 'insideTop',
            verticalAlign: 'top',
            backgroundColor: theme.colors.grayscale.light5,
          },
        }
      : {
          show: false,
          color: theme.colors.grayscale.dark2,
          // @ts-ignore
          emphasis: {
            fontWeight: 'bold',
            show: true,
            position: 'insideTop',
            verticalAlign: 'top',
            backgroundColor: theme.colors.grayscale.light5,
          },
        };
    series.push({
      id: `Interval - ${label}`,
      type: 'line',
      animation: false,
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
        data: intervalData,
      },
    });
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
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  annotations.forEach(annotation => {
    const { name, color, opacity, style, width, showLabel } = layer;
    const { descriptions, time, title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const eventData: MarkLine1DDataItemOption[] = [
      {
        name: label,
        xAxis: time,
      },
    ];

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
          color: theme.colors.grayscale.dark2,
          position: 'insideEndTop',
          fontWeight: 'bold',
          formatter: (params: CallbackDataParams) => params.name,
          // @ts-ignore
          emphasis: {
            backgroundColor: theme.colors.grayscale.light5,
          },
        }
      : {
          show: false,
          color: theme.colors.grayscale.dark2,
          position: 'insideEndTop',
          // @ts-ignore
          emphasis: {
            formatter: (params: CallbackDataParams) => params.name,
            fontWeight: 'bold',
            show: true,
            backgroundColor: theme.colors.grayscale.light5,
          },
        };

    series.push({
      id: `Event - ${label}`,
      type: 'line',
      animation: false,
      markLine: {
        silent: false,
        symbol: 'none',
        lineStyle,
        label: eventLabel,
        data: eventData,
      },
    });
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
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const { hideLine, name, opacity, showMarkers, style, width, color } = layer;
  const result = annotationData[name];
  if (isTimeseriesAnnotationResult(result)) {
    result.forEach(annotation => {
      const { key, values } = annotation;
      series.push({
        type: 'line',
        id: key,
        name: key,
        data: values.map(row => [row.x, row.y] as [OptionName, number]),
        symbolSize: showMarkers ? markerSize : 0,
        lineStyle: {
          opacity: parseAnnotationOpacity(opacity),
          type: style as ZRLineType,
          width: hideLine ? 0 : width,
          color: color || colorScale(name, sliceId),
        },
      });
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
  return getChartPadding(showLegend, legendOrientation, margin, {
    top:
      yAxisTitlePosition && yAxisTitlePosition === 'Top'
        ? TIMESERIES_CONSTANTS.gridOffsetTop + (Number(yAxisTitleMargin) || 0)
        : TIMESERIES_CONSTANTS.gridOffsetTop + yAxisOffset,
    bottom: zoomable
      ? TIMESERIES_CONSTANTS.gridOffsetBottomZoomable + xAxisOffset
      : TIMESERIES_CONSTANTS.gridOffsetBottom + xAxisOffset,
    left:
      yAxisTitlePosition === 'Left'
        ? TIMESERIES_CONSTANTS.gridOffsetLeft + (Number(yAxisTitleMargin) || 0)
        : TIMESERIES_CONSTANTS.gridOffsetLeft,
    right:
      showLegend && legendOrientation === LegendOrientation.Right
        ? 0
        : TIMESERIES_CONSTANTS.gridOffsetRight,
  });
}
