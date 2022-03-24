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
  DataRecordValue,
  DTTM_ALIAS,
  GenericDataType,
  getNumberFormatter,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
  TimeseriesChartDataResponseResult,
} from '@superset-ui/core';
import { EChartsCoreOption, SeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA,
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
  TimeseriesChartTransformedProps,
} from './types';
import { ForecastSeriesEnum, ForecastValue } from '../types';
import { parseYAxisBound } from '../utils/controls';
import {
  currentSeries,
  dedupSeries,
  extractSeries,
  getColtypesMapping,
  getLegendProps,
} from '../utils/series';
import { extractAnnotationLabels } from '../utils/annotation';
import {
  extractForecastSeriesContext,
  extractForecastSeriesContexts,
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
  rebaseForecastDatum,
} from '../utils/forecast';
import { convertInteger } from '../utils/convertInteger';
import { defaultGrid, defaultTooltip, defaultYAxis } from '../defaults';
import {
  getPadding,
  getTooltipTimeFormatter,
  getXAxisFormatter,
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformSeries,
  transformTimeseriesAnnotation,
} from './transformers';
import { TIMESERIES_CONSTANTS } from '../constants';

export default function transformProps(
  chartProps: EchartsTimeseriesChartProps,
): TimeseriesChartTransformedProps {
  const {
    width,
    height,
    filterState,
    formData,
    hooks,
    queriesData,
    datasource,
  } = chartProps;
  const { verboseMap = {} } = datasource;
  const [queryData] = queriesData;
  const { annotation_data: annotationData_, data = [] } =
    queryData as TimeseriesChartDataResponseResult;
  const dataTypes = getColtypesMapping(queryData);
  const annotationData = annotationData_ || {};

  const {
    area,
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    legendOrientation,
    legendType,
    legendMargin,
    logAxis,
    markerEnabled,
    markerSize,
    opacity,
    minorSplitLine,
    seriesType,
    showLegend,
    stack,
    truncateYAxis,
    yAxisFormat,
    xAxisTimeFormat,
    yAxisBounds,
    tooltipTimeFormat,
    tooltipSortByMetric,
    zoomable,
    richTooltip,
    xAxis: xAxisOrig,
    xAxisLabelRotation,
    emitFilter,
    groupby,
    showValue,
    onlyTotal,
    percentageThreshold,
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
    sliceId,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseForecastDatum(data, verboseMap);
  const xAxisCol = verboseMap[xAxisOrig] || xAxisOrig || DTTM_ALIAS;
  const rawSeries = extractSeries(rebasedData, {
    fillNeighborValue: stack && !forecastEnabled ? 0 : undefined,
    xAxis: xAxisCol,
    removeNulls: seriesType === EchartsTimeseriesSeriesType.Scatter,
  });
  const seriesContexts = extractForecastSeriesContexts(
    Object.values(rawSeries).map(series => series.name as string),
  );
  const xAxisDataType = dataTypes?.[xAxisCol];
  let xAxisType: 'time' | 'value' | 'category';
  switch (xAxisDataType) {
    case GenericDataType.TEMPORAL:
      xAxisType = 'time';
      break;
    case GenericDataType.NUMERIC:
      xAxisType = 'value';
      break;
    default:
      xAxisType = 'category';
      break;
  }
  const series: SeriesOption[] = [];
  const formatter = getNumberFormatter(contributionMode ? ',.0%' : yAxisFormat);

  const totalStackedValues: number[] = [];
  const showValueIndexes: number[] = [];
  const thresholdValues: number[] = [];

  rebasedData.forEach(data => {
    const values = Object.keys(data).reduce((prev, curr) => {
      if (curr === xAxisCol) {
        return prev;
      }
      const value = data[curr] || 0;
      return prev + (value as number);
    }, 0);
    totalStackedValues.push(values);
    thresholdValues.push(((percentageThreshold || 0) / 100) * values);
  });

  if (stack) {
    rawSeries.forEach((entry, seriesIndex) => {
      const { data = [] } = entry;
      (data as [Date, number][]).forEach((datum, dataIndex) => {
        if (datum[1] !== null) {
          showValueIndexes[dataIndex] = seriesIndex;
        }
      });
    });
  }

  rawSeries.forEach(entry => {
    const transformedSeries = transformSeries(entry, colorScale, {
      area,
      filterState,
      seriesContexts,
      markerEnabled,
      markerSize,
      areaOpacity: opacity,
      seriesType,
      stack,
      formatter,
      showValue,
      onlyTotal,
      totalStackedValues,
      showValueIndexes,
      thresholdValues,
      richTooltip,
      sliceId,
    });
    if (transformedSeries) series.push(transformedSeries);
  });

  const selectedValues = (filterState.selectedValues || []).reduce(
    (acc: Record<string, number>, selectedValue: string) => {
      const index = series.findIndex(({ name }) => name === selectedValue);
      return {
        ...acc,
        [index]: selectedValue,
      };
    },
    {},
  );

  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(
          transformFormulaAnnotation(layer, data, colorScale, sliceId),
        );
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            sliceId,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            sliceId,
          ),
        );
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            markerSize,
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

  const tooltipFormatter =
    xAxisDataType === GenericDataType.TEMPORAL
      ? getTooltipTimeFormatter(tooltipTimeFormat)
      : String;
  const xAxisFormatter =
    xAxisDataType === GenericDataType.TEMPORAL
      ? getXAxisFormatter(xAxisTimeFormat)
      : String;

  const labelMap = series.reduce(
    (acc: Record<string, DataRecordValue[]>, datum) => {
      const name: string = datum.name as string;
      return {
        ...acc,
        [name]: [name],
      };
    },
    {},
  );

  const { setDataMask = () => {} } = hooks;

  const addYAxisLabelOffset = !!yAxisTitle;
  const addXAxisLabelOffset = !!xAxisTitle;
  const padding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisLabelOffset,
    zoomable,
    legendMargin,
    addXAxisLabelOffset,
    yAxisTitlePosition,
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );

  const legendData = rawSeries
    .filter(
      entry =>
        extractForecastSeriesContext(entry.name || '').type ===
        ForecastSeriesEnum.Observation,
    )
    .map(entry => entry.name || '')
    .concat(extractAnnotationLabels(annotationLayers, annotationData));

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...padding,
    },
    xAxis: {
      type: xAxisType,
      name: xAxisTitle,
      nameGap: convertInteger(xAxisTitleMargin),
      nameLocation: 'middle',
      axisLabel: {
        hideOverlap: true,
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
      name: yAxisTitle,
      nameGap: convertInteger(yAxisTitleMargin),
      nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
    },
    tooltip: {
      ...defaultTooltip,
      appendToBody: true,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) => {
        const xValue: number = richTooltip
          ? params[0].value[0]
          : params.value[0];
        const forecastValue: any[] = richTooltip ? params : [params];

        if (richTooltip && tooltipSortByMetric) {
          forecastValue.sort((a, b) => b.data[1] - a.data[1]);
        }

        const rows: Array<string> = [`${tooltipFormatter(xValue)}`];
        const forecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(forecastValue);

        Object.keys(forecastValues).forEach(key => {
          const value = forecastValues[key];
          const content = formatForecastTooltipSeries({
            ...value,
            seriesName: key,
            formatter,
          });
          if (currentSeries.name === key) {
            rows.push(`<span style="font-weight: 700">${content}</span>`);
          } else {
            rows.push(`<span style="opacity: 0.7">${content}</span>`);
          }
        });
        return rows.join('<br />');
      },
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, zoomable),
      data: legendData as string[],
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
    emitFilter,
    formData,
    groupby,
    height,
    labelMap,
    selectedValues,
    setDataMask,
    width,
    legendData,
  };
}
