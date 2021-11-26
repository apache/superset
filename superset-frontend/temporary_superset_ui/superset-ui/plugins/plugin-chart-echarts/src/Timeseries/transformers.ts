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
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  isTimeseriesAnnotationResult,
  TimeseriesAnnotationLayer,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import { extractForecastSeriesContext } from '../utils/prophet';
import { ForecastSeriesEnum } from '../types';
import { DEFAULT_FORM_DATA, EchartsTimeseriesFormData } from './types';
import {
  evalFormula,
  extractRecordAnnotations,
  formatAnnotationLabel,
  parseAnnotationOpacity,
} from '../utils/annotation';

export function transformSeries(
  series: echarts.EChartOption.Series,
  formData: EchartsTimeseriesFormData,
  colorScale: CategoricalColorScale,
): echarts.EChartOption.Series | undefined {
  const { name } = series;
  const { area, forecastEnabled, markerEnabled, markerSize, opacity, seriesType, stack } = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };
  const forecastSeries = extractForecastSeriesContext(name || '');
  const isConfidenceBand =
    forecastSeries.type === ForecastSeriesEnum.ForecastLower ||
    forecastSeries.type === ForecastSeriesEnum.ForecastUpper;

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
  if (!isConfidenceBand && (seriesType === 'scatter' || (forecastEnabled && isObservation))) {
    plotType = 'scatter';
  } else if (isConfidenceBand) {
    plotType = 'line';
  } else {
    plotType = seriesType === 'bar' ? 'bar' : 'line';
  }
  const lineStyle = isConfidenceBand ? { opacity: 0 } : {};

  return {
    ...series,
    name: forecastSeries.name,
    itemStyle: {
      color: colorScale(forecastSeries.name),
    },
    type: plotType,
    // @ts-ignore
    smooth: seriesType === 'smooth',
    step: ['start', 'middle', 'end'].includes(seriesType as string) ? seriesType : undefined,
    stack: stackId,
    lineStyle,
    areaStyle: {
      opacity: forecastSeries.type === ForecastSeriesEnum.ForecastUpper || area ? opacity : 0,
    },
    showSymbol:
      !isConfidenceBand &&
      (plotType === 'scatter' || (forecastEnabled && isObservation) || markerEnabled),
    symbolSize: markerSize,
  };
}

export function transformFormulaAnnotation(
  layer: FormulaAnnotationLayer,
  data: TimeseriesDataRecord[],
  colorScale: CategoricalColorScale,
): echarts.EChartOption.Series {
  const { name, color, opacity, width, style } = layer;
  return {
    name,
    id: name,
    itemStyle: {
      color: color || colorScale(name),
    },
    lineStyle: {
      opacity: parseAnnotationOpacity(opacity),
      type: style,
      width,
    },
    type: 'line',
    smooth: true,
    // @ts-ignore
    data: evalFormula(layer, data),
    symbolSize: 0,
    z: 0,
  };
}

export function transformIntervalAnnotation(
  layer: IntervalAnnotationLayer,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
  colorScale: CategoricalColorScale,
): echarts.EChartOption.Series[] {
  const series: echarts.EChartOption.Series[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  annotations.forEach(annotation => {
    const { name, color, opacity } = layer;
    const { descriptions, intervalEnd, time, title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const intervalData = [
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
        },
        label: {
          show: false,
          color: '#000000',
          emphasis: {
            fontWeight: 'bold',
            show: true,
            position: 'insideTop',
            verticalAlign: 'top',
            backgroundColor: '#ffffff',
          },
        },
        // @ts-ignore
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
): echarts.EChartOption.Series[] {
  const series: echarts.EChartOption.Series[] = [];
  const annotations = extractRecordAnnotations(layer, annotationData);
  annotations.forEach(annotation => {
    const { name, color, opacity, style, width } = layer;
    const { descriptions, time, title } = annotation;
    const label = formatAnnotationLabel(name, title, descriptions);
    const eventData = [
      {
        name: label,
        xAxis: time,
      },
    ];
    series.push({
      id: `Event - ${label}`,
      type: 'line',
      animation: false,
      markLine: {
        silent: false,
        symbol: 'none',
        lineStyle: {
          width,
          type: style,
          color: color || colorScale(name),
          opacity: parseAnnotationOpacity(opacity),
          emphasis: {
            width: width ? width + 1 : width,
            opacity: 1,
          },
        },
        label: {
          show: false,
          color: '#000000',
          position: 'insideEndTop',
          emphasis: {
            // @ts-ignore
            formatter: params =>
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              params.name,
            // @ts-ignore
            fontWeight: 'bold',
            show: true,
            backgroundColor: '#ffffff',
          },
        },
        // @ts-ignore
        data: eventData,
      },
    });
  });
  return series;
}

export function transformTimeseriesAnnotation(
  layer: TimeseriesAnnotationLayer,
  formData: EchartsTimeseriesFormData,
  data: TimeseriesDataRecord[],
  annotationData: AnnotationData,
): echarts.EChartOption.Series[] {
  const series: echarts.EChartOption.Series[] = [];
  const { markerSize } = formData;
  const { hideLine, name, opacity, showMarkers, style, width } = layer;
  const result = annotationData[name];
  if (isTimeseriesAnnotationResult(result)) {
    result.forEach(annotation => {
      const { key, values } = annotation;
      series.push({
        type: 'line',
        id: key,
        name: key,
        data: values.map(row => [row.x, row.y] as [number | string, number]),
        symbolSize: showMarkers ? markerSize : 0,
        lineStyle: {
          opacity: parseAnnotationOpacity(opacity),
          type: style,
          width: hideLine ? 0 : width,
        },
      });
    });
  }
  return series;
}
