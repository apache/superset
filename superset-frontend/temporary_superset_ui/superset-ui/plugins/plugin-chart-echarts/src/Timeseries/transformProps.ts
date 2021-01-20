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
  AnnotationData,
  AnnotationLayer,
  CategoricalColorNamespace,
  ChartProps,
  getNumberFormatter,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
  smartDateVerboseFormatter,
  TimeseriesDataRecord,
  getTimeFormatter,
  getTimeFormatterForGranularity,
  smartDateFormatter,
} from '@superset-ui/core';
import { DEFAULT_FORM_DATA, EchartsTimeseriesFormData } from './types';
import { EchartsProps, ForecastSeriesEnum } from '../types';
import { parseYAxisBound } from '../utils/controls';
import { extractTimeseriesSeries } from '../utils/series';
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

export default function transformProps(chartProps: ChartProps): EchartsProps {
  const { width, height, formData, queriesData } = chartProps;

  const {
    annotation_data: annotationData = {},
    data = [],
  }: { annotation_data?: AnnotationData; data?: TimeseriesDataRecord[] } = queriesData[0];

  const {
    annotationLayers,
    colorScheme,
    contributionMode,
    logAxis,
    stack,
    minorSplitLine,
    truncateYAxis,
    yAxisFormat,
    xAxisShowMinLabel,
    xAxisShowMaxLabel,
    xAxisTimeFormat,
    yAxisBounds,
    timeGrainSqla,
    zoomable,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseTimeseriesDatum(data);
  const rawSeries = extractTimeseriesSeries(rebasedData);
  const series: echarts.EChartOption.Series[] = [];
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

  const echartOptions: echarts.EChartOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      top: 30,
      bottom: zoomable ? 80 : 0,
      left: 20,
      right: 20,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        showMinLabel: xAxisShowMinLabel,
        showMaxLabel: xAxisShowMaxLabel,
        formatter: (value: any) => {
          let dateFormatter;

          if (xAxisTimeFormat === smartDateFormatter.id) {
            dateFormatter = getTimeFormatterForGranularity(timeGrainSqla);
          } else if (xAxisTimeFormat) {
            dateFormatter = getTimeFormatter(xAxisTimeFormat);
          } else {
            dateFormatter = String;
          }

          return dateFormatter(value);
        },
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
      trigger: 'axis',
      formatter: params => {
        // @ts-ignore
        const rows = [`${smartDateVerboseFormatter(params[0].value[0])}`];
        // @ts-ignore
        const prophetValues = extractProphetValuesFromTooltipParams(params);
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
      data: rawSeries
        .filter(
          entry =>
            extractForecastSeriesContext(entry.name || '').type === ForecastSeriesEnum.Observation,
        )
        .map(entry => entry.name || '')
        .concat(extractAnnotationLabels(annotationLayers, annotationData)),
      right: zoomable ? 80 : 'auto',
    },
    series,
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
    dataZoom: zoomable
      ? [
          {
            type: 'slider',
            start: 0,
            end: 100,
            bottom: 20,
          },
        ]
      : [],
  };

  return {
    // @ts-ignore
    echartOptions,
    width,
    height,
  };
}
