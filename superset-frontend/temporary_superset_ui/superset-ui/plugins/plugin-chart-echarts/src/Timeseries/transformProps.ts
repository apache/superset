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
/* eslint-disable camelcase */
import {
  AnnotationLayer,
  CategoricalColorNamespace,
  ChartProps,
  getNumberFormatter,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
  getTimeFormatter,
  smartDateFormatter,
  smartDateDetailedFormatter,
  TimeseriesChartDataResponseResult,
  TimeFormatter,
} from '@superset-ui/core';
import { EChartsOption, SeriesOption } from 'echarts';
import { DEFAULT_FORM_DATA, EchartsTimeseriesFormData } from './types';
import { EchartsProps, ForecastSeriesEnum, ProphetValue, LegendOrientation } from '../types';
import { parseYAxisBound } from '../utils/controls';
import {
  dedupSeries,
  extractTimeseriesSeries,
  getChartPadding,
  getLegendProps,
} from '../utils/series';
import { extractAnnotationLabels } from '../utils/annotation';
import {
  extractForecastSeriesContext,
  extractProphetValuesFromTooltipParams,
  formatProphetTooltipSeries,
  rebaseTimeseriesDatum,
} from '../utils/prophet';
import { defaultGrid, defaultTooltip, defaultYAxis } from '../defaults';
import {
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformSeries,
  transformTimeseriesAnnotation,
} from './transformers';
import { TIMESERIES_CONSTANTS } from '../constants';

export default function transformProps(chartProps: ChartProps): EchartsProps {
  const { width, height, formData, queriesData } = chartProps;
  const {
    annotation_data: annotationData_,
    data = [],
  } = queriesData[0] as TimeseriesChartDataResponseResult;
  const annotationData = annotationData_ || {};

  const {
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    legendMargin,
    legendOrientation,
    legendType,
    logAxis,
    minorSplitLine,
    showLegend,
    stack,
    truncateYAxis,
    yAxisFormat,
    xAxisShowMinLabel,
    xAxisShowMaxLabel,
    xAxisTimeFormat,
    yAxisBounds,
    tooltipTimeFormat,
    zoomable,
    richTooltip,
    xAxisLabelRotation,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseTimeseriesDatum(data);
  const rawSeries = extractTimeseriesSeries(rebasedData, {
    fillNeighborValue: stack && !forecastEnabled ? 0 : undefined,
  });
  const series: SeriesOption[] = [];
  const formatter = getNumberFormatter(contributionMode ? ',.0%' : yAxisFormat);

  rawSeries.forEach(entry => {
    const transformedSeries = transformSeries(
      entry,
      formData as EchartsTimeseriesFormData,
      colorScale,
    );
    if (transformedSeries) series.push(transformedSeries);
  });

  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(transformFormulaAnnotation(layer, data, colorScale));
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(...transformIntervalAnnotation(layer, data, annotationData, colorScale));
      } else if (isEventAnnotationLayer(layer)) {
        series.push(...transformEventAnnotation(layer, data, annotationData, colorScale));
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            formData as EchartsTimeseriesFormData,
            data,
            annotationData,
          ),
        );
      }
    });

  // yAxisBounds need to be parsed to replace incompatible values with undefined
  let [min, max] = (yAxisBounds || []).map(parseYAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if (contributionMode === 'row' && stack) {
    if (min === undefined) min = 0;
    if (max === undefined) max = 1;
  }

  let tooltipFormatter: TimeFormatter | StringConstructor;
  if (tooltipTimeFormat === smartDateFormatter.id) {
    tooltipFormatter = smartDateDetailedFormatter;
  } else if (tooltipTimeFormat) {
    tooltipFormatter = getTimeFormatter(xAxisTimeFormat);
  } else {
    tooltipFormatter = String;
  }

  let xAxisFormatter: TimeFormatter | StringConstructor | undefined;
  if (xAxisTimeFormat === smartDateFormatter.id || !xAxisTimeFormat) {
    xAxisFormatter = undefined;
  } else if (xAxisTimeFormat) {
    xAxisFormatter = getTimeFormatter(xAxisTimeFormat);
  } else {
    xAxisFormatter = String;
  }

  const echartOptions: EChartsOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...getChartPadding(showLegend, legendOrientation, legendMargin, {
        top: TIMESERIES_CONSTANTS.gridOffsetTop,
        bottom: zoomable
          ? TIMESERIES_CONSTANTS.gridOffsetBottomZoomable
          : TIMESERIES_CONSTANTS.gridOffsetBottom,
        left: TIMESERIES_CONSTANTS.gridOffsetLeft,
        right:
          showLegend && legendOrientation === LegendOrientation.Right
            ? 0
            : TIMESERIES_CONSTANTS.gridOffsetRight,
      }),
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        showMinLabel: xAxisShowMinLabel,
        showMaxLabel: xAxisShowMaxLabel,
        formatter: xAxisFormatter,
        rotate: xAxisLabelRotation,
      },
    },
    yAxis: {
      ...defaultYAxis,
      type: logAxis ? 'log' : 'value',
      min,
      max,
      minorTick: { show: true },
      minorSplitLine: { show: minorSplitLine },
      axisLabel: { formatter },
      scale: truncateYAxis,
    },
    tooltip: {
      ...defaultTooltip,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) => {
        const value: number = !richTooltip ? params.value : params[0].value[0];
        const prophetValue = !richTooltip ? [params] : params;

        const rows: Array<string> = [`${tooltipFormatter(value)}`];
        const prophetValues: Record<string, ProphetValue> = extractProphetValuesFromTooltipParams(
          prophetValue,
        );

        Object.keys(prophetValues).forEach(key => {
          const value = prophetValues[key];
          rows.push(
            formatProphetTooltipSeries({
              ...value,
              seriesName: key,
              formatter,
            }),
          );
        });
        return rows.join('<br />');
      },
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, zoomable),
      // @ts-ignore
      data: rawSeries
        .filter(
          entry =>
            extractForecastSeriesContext((entry.name || '') as string).type ===
            ForecastSeriesEnum.Observation,
        )
        .map(entry => entry.name || '')
        .concat(extractAnnotationLabels(annotationLayers, annotationData)),
    },
    series: dedupSeries(series),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
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
    dataZoom: zoomable
      ? [
          {
            type: 'slider',
            start: TIMESERIES_CONSTANTS.dataZoomStart,
            end: TIMESERIES_CONSTANTS.dataZoomEnd,
            bottom: TIMESERIES_CONSTANTS.zoomBottom,
          },
        ]
      : [],
  };

  return {
    echartOptions,
    width,
    height,
  };
}
