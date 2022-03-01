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
  CategoricalColorScale,
  EventAnnotationLayer,
  FilterState,
  FormulaAnnotationLayer,
  getTimeFormatter,
  IntervalAnnotationLayer,
  isTimeseriesAnnotationResult,
  NumberFormatter,
  smartDateDetailedFormatter,
  smartDateFormatter,
  TimeFormatter,
  TimeseriesAnnotationLayer,
  TimeseriesDataRecord,
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
import { ForecastSeriesEnum, LegendOrientation } from '../types';
import { EchartsTimeseriesSeriesType } from './types';

import {
  evalFormula,
  extractRecordAnnotations,
  formatAnnotationLabel,
  parseAnnotationOpacity,
} from '../utils/annotation';
import { currentSeries, getChartPadding } from '../utils/series';
import { OpacityEnum, TIMESERIES_CONSTANTS } from '../constants';

export function transformSeries(
  series: SeriesOption,
  colorScale: CategoricalColorScale,
  opts: {
    area?: boolean;
    filterState?: FilterState;
    seriesContexts?: { [key: string]: ForecastSeriesEnum[] };
    markerEnabled?: boolean;
    markerSize?: number;
    areaOpacity?: number;
    seriesType?: EchartsTimeseriesSeriesType;
    stack?: boolean;
    yAxisIndex?: number;
    showValue?: boolean;
    onlyTotal?: boolean;
    formatter?: NumberFormatter;
    totalStackedValues?: number[];
    showValueIndexes?: number[];
    thresholdValues?: number[];
    richTooltip?: boolean;
    seriesKey?: OptionName;
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
    totalStackedValues = [],
    showValueIndexes = [],
    thresholdValues = [],
    richTooltip,
    seriesKey,
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
    color: colorScale(seriesKey || forecastSeries.name),
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
  const lineStyle = isConfidenceBand
    ? { opacity: OpacityEnum.Transparent }
    : { opacity };
  return {
    ...series,
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
      position: 'top',
      formatter: (params: any) => {
        const {
          value: [, numericValue],
          dataIndex,
          seriesIndex,
          seriesName,
        } = params;
        const isSelectedLegend = currentSeries.legend === seriesName;
        if (!formatter) return numericValue;
        if (!stack || isSelectedLegend) return formatter(numericValue);
        if (!onlyTotal) {
          if (numericValue >= thresholdValues[dataIndex]) {
            return formatter(numericValue);
          }
          return '';
        }
        if (seriesIndex === showValueIndexes[dataIndex]) {
          return formatter(totalStackedValues[dataIndex]);
        }
        return '';
      },
    },
  };
}

export function transformFormulaAnnotation(
  layer: FormulaAnnotationLayer,
  data: TimeseriesDataRecord[],
  colorScale: CategoricalColorScale,
): SeriesOption {
  const { name, color, opacity, width, style } = layer;
  return {
    name,
    id: name,
    itemStyle: {
      color: color || colorScale(name),
    },
    lineStyle: {
      opacity: parseAnnotationOpacity(opacity),
      type: style as ZRLineType,
      width,
    },
    type: 'line',
    smooth: true,
    data: evalFormula(layer, data),
    symbolSize: 0,
  };
}

export function transformIntervalAnnotation(
  layer: IntervalAnnotationLayer,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
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
          color: '#000000',
          position: 'insideTop',
          verticalAlign: 'top',
          fontWeight: 'bold',
          // @ts-ignore
          emphasis: {
            position: 'insideTop',
            verticalAlign: 'top',
            backgroundColor: '#ffffff',
          },
        }
      : {
          show: false,
          color: '#000000',
          // @ts-ignore
          emphasis: {
            fontWeight: 'bold',
            show: true,
            position: 'insideTop',
            verticalAlign: 'top',
            backgroundColor: '#ffffff',
          },
        };
    series.push({
      id: `Interval - ${label}`,
      type: 'line',
      animation: false,
      markArea: {
        silent: false,
        itemStyle: {
          color: color || colorScale(name),
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
        xAxis: time as unknown as number,
      },
    ];

    const lineStyle: LineStyleOption & DefaultStatesMixin['emphasis'] = {
      width,
      type: style as ZRLineType,
      color: color || colorScale(name),
      opacity: parseAnnotationOpacity(opacity),
      emphasis: {
        width: width ? width + 1 : width,
        opacity: 1,
      },
    };

    const eventLabel: SeriesLineLabelOption = showLabel
      ? {
          show: true,
          color: '#000000',
          position: 'insideEndTop',
          fontWeight: 'bold',
          formatter: (params: CallbackDataParams) => params.name,
          // @ts-ignore
          emphasis: {
            backgroundColor: '#ffffff',
          },
        }
      : {
          show: false,
          color: '#000000',
          position: 'insideEndTop',
          // @ts-ignore
          emphasis: {
            formatter: (params: CallbackDataParams) => params.name,
            fontWeight: 'bold',
            show: true,
            backgroundColor: '#ffffff',
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
): SeriesOption[] {
  const series: SeriesOption[] = [];
  const { hideLine, name, opacity, showMarkers, style, width } = layer;
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

export function getTooltipTimeFormatter(
  format?: string,
): TimeFormatter | StringConstructor {
  if (format === smartDateFormatter.id) {
    return smartDateDetailedFormatter;
  }
  if (format) {
    return getTimeFormatter(format);
  }
  return String;
}

export function getXAxisFormatter(
  format?: string,
): TimeFormatter | StringConstructor | undefined {
  if (format === smartDateFormatter.id || !format) {
    return undefined;
  }
  if (format) {
    return getTimeFormatter(format);
  }
  return String;
}
