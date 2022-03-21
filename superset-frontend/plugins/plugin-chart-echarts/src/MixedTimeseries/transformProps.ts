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
  TimeseriesDataRecord,
  getNumberFormatter,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
} from '@superset-ui/core';
import { EChartsCoreOption, SeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesChartTransformedProps,
  EchartsMixedTimeseriesProps,
} from './types';
import { ForecastSeriesEnum } from '../types';
import { parseYAxisBound } from '../utils/controls';
import {
  currentSeries,
  dedupSeries,
  extractSeries,
  getLegendProps,
} from '../utils/series';
import { extractAnnotationLabels } from '../utils/annotation';
import {
  extractForecastSeriesContext,
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
} from '../Timeseries/transformers';
import { TIMESERIES_CONSTANTS } from '../constants';

export default function transformProps(
  chartProps: EchartsMixedTimeseriesProps,
): EchartsMixedTimeseriesChartTransformedProps {
  const {
    width,
    height,
    formData,
    queriesData,
    hooks,
    filterState,
    datasource,
  } = chartProps;
  const { annotation_data: annotationData_ } = queriesData[0];
  const annotationData = annotationData_ || {};
  const { verboseMap = {} } = datasource;
  const data1 = (queriesData[0].data || []) as TimeseriesDataRecord[];
  const data2 = (queriesData[1].data || []) as TimeseriesDataRecord[];

  const {
    area,
    areaB,
    annotationLayers,
    colorScheme,
    contributionMode,
    legendOrientation,
    legendType,
    logAxis,
    logAxisSecondary,
    markerEnabled,
    markerEnabledB,
    markerSize,
    markerSizeB,
    opacity,
    opacityB,
    minorSplitLine,
    seriesType,
    seriesTypeB,
    showLegend,
    showValue,
    showValueB,
    stack,
    stackB,
    truncateYAxis,
    tooltipTimeFormat,
    yAxisFormat,
    yAxisFormatSecondary,
    xAxisTimeFormat,
    yAxisBounds,
    yAxisIndex,
    yAxisIndexB,
    yAxisTitleSecondary,
    zoomable,
    richTooltip,
    tooltipSortByMetric,
    xAxisLabelRotation,
    groupby,
    groupbyB,
    emitFilter,
    emitFilterB,
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
    sliceId,
  }: EchartsMixedTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedDataA = rebaseForecastDatum(data1, verboseMap);
  const rawSeriesA = extractSeries(rebasedDataA, {
    fillNeighborValue: stack ? 0 : undefined,
  });
  const rebasedDataB = rebaseForecastDatum(data2, verboseMap);
  const rawSeriesB = extractSeries(rebasedDataB, {
    fillNeighborValue: stackB ? 0 : undefined,
  });

  const series: SeriesOption[] = [];
  const formatter = getNumberFormatter(contributionMode ? ',.0%' : yAxisFormat);
  const formatterSecondary = getNumberFormatter(
    contributionMode ? ',.0%' : yAxisFormatSecondary,
  );

  const primarySeries = new Set<string>();
  const secondarySeries = new Set<string>();
  const mapSeriesIdToAxis = (
    seriesOption: SeriesOption,
    index?: number,
  ): void => {
    if (index === 1) {
      secondarySeries.add(seriesOption.id as string);
    } else {
      primarySeries.add(seriesOption.id as string);
    }
  };
  rawSeriesA.forEach(seriesOption =>
    mapSeriesIdToAxis(seriesOption, yAxisIndex),
  );
  rawSeriesB.forEach(seriesOption =>
    mapSeriesIdToAxis(seriesOption, yAxisIndexB),
  );

  rawSeriesA.forEach(entry => {
    const transformedSeries = transformSeries(entry, colorScale, {
      area,
      markerEnabled,
      markerSize,
      areaOpacity: opacity,
      seriesType,
      showValue,
      stack,
      yAxisIndex,
      filterState,
      seriesKey: entry.name,
      sliceId,
    });
    if (transformedSeries) series.push(transformedSeries);
  });

  rawSeriesB.forEach(entry => {
    const transformedSeries = transformSeries(entry, colorScale, {
      area: areaB,
      markerEnabled: markerEnabledB,
      markerSize: markerSizeB,
      areaOpacity: opacityB,
      seriesType: seriesTypeB,
      showValue: showValueB,
      stack: stackB,
      yAxisIndex: yAxisIndexB,
      filterState,
      seriesKey: primarySeries.has(entry.name as string)
        ? `${entry.name} (1)`
        : entry.name,
      sliceId,
    });
    if (transformedSeries) series.push(transformedSeries);
  });

  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(
          transformFormulaAnnotation(layer, data1, colorScale, sliceId),
        );
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data1,
            annotationData,
            colorScale,
            sliceId,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(
            layer,
            data1,
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
            data1,
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

  const tooltipTimeFormatter = getTooltipTimeFormatter(tooltipTimeFormat);
  const xAxisFormatter = getXAxisFormatter(xAxisTimeFormat);

  const addYAxisTitleOffset = !!(yAxisTitle || yAxisTitleSecondary);
  const addXAxisTitleOffset = !!xAxisTitle;

  const chartPadding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisTitleOffset,
    zoomable,
    null,
    addXAxisTitleOffset,
    yAxisTitlePosition,
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );
  const labelMap = rawSeriesA.reduce((acc, datum) => {
    const label = datum.name as string;
    return {
      ...acc,
      [label]: label.split(', '),
    };
  }, {}) as Record<string, DataRecordValue[]>;

  const labelMapB = rawSeriesB.reduce((acc, datum) => {
    const label = datum.name as string;
    return {
      ...acc,
      [label]: label.split(', '),
    };
  }, {}) as Record<string, DataRecordValue[]>;

  const { setDataMask = () => {} } = hooks;
  const alignTicks = yAxisIndex !== yAxisIndexB;

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...chartPadding,
    },
    xAxis: {
      type: 'time',
      name: xAxisTitle,
      nameGap: convertInteger(xAxisTitleMargin),
      nameLocation: 'middle',
      axisLabel: {
        formatter: xAxisFormatter,
        rotate: xAxisLabelRotation,
      },
    },
    yAxis: [
      {
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
        alignTicks,
      },
      {
        ...defaultYAxis,
        type: logAxisSecondary ? 'log' : 'value',
        min,
        max,
        minorTick: { show: true },
        splitLine: { show: false },
        minorSplitLine: { show: minorSplitLine },
        axisLabel: { formatter: formatterSecondary },
        scale: truncateYAxis,
        name: yAxisTitleSecondary,
        alignTicks,
      },
    ],
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

        const rows: Array<string> = [`${tooltipTimeFormatter(xValue)}`];
        const forecastValues =
          extractForecastValuesFromTooltipParams(forecastValue);

        Object.keys(forecastValues).forEach(key => {
          const value = forecastValues[key];
          const content = formatForecastTooltipSeries({
            ...value,
            seriesName: key,
            formatter: primarySeries.has(key) ? formatter : formatterSecondary,
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
      // @ts-ignore
      data: rawSeriesA
        .concat(rawSeriesB)
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
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitFilter,
    emitFilterB,
    labelMap,
    labelMapB,
    groupby,
    groupbyB,
    seriesBreakdown: rawSeriesA.length,
    selectedValues: filterState.selectedValues || [],
  };
}
