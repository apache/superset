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
import { invert } from 'lodash';
import {
  AnnotationLayer,
  CategoricalColorNamespace,
  GenericDataType,
  getNumberFormatter,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
  QueryFormData,
  TimeseriesChartDataResponseResult,
  TimeseriesDataRecord,
  getXAxisLabel,
  isPhysicalColumn,
  isDefined,
  ensureIsArray,
  buildCustomFormatters,
  ValueFormatter,
  QueryFormMetric,
  getCustomFormatter,
  CurrencyFormatter,
} from '@superset-ui/core';
import { getOriginalSeries } from '@superset-ui/chart-controls';
import { EChartsCoreOption, SeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesChartTransformedProps,
  EchartsMixedTimeseriesProps,
} from './types';
import {
  EchartsTimeseriesSeriesType,
  ForecastSeriesEnum,
  Refs,
} from '../types';
import { parseAxisBound } from '../utils/controls';
import {
  getOverMaxHiddenFormatter,
  dedupSeries,
  extractSeries,
  getAxisType,
  getColtypesMapping,
  getLegendProps,
  extractDataTotalValues,
  extractShowValueIndexes,
} from '../utils/series';
import {
  extractAnnotationLabels,
  getAnnotationData,
} from '../utils/annotation';
import {
  extractForecastSeriesContext,
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
  rebaseForecastDatum,
} from '../utils/forecast';
import { convertInteger } from '../utils/convertInteger';
import { defaultGrid, defaultYAxis } from '../defaults';
import {
  getPadding,
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformSeries,
  transformTimeseriesAnnotation,
} from '../Timeseries/transformers';
import { TIMESERIES_CONSTANTS, TIMEGRAIN_TO_TIMESTAMP } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import {
  getTooltipTimeFormatter,
  getXAxisFormatter,
  getYAxisFormatter,
} from '../utils/formatters';

const getFormatter = (
  customFormatters: Record<string, ValueFormatter>,
  defaultFormatter: ValueFormatter,
  metrics: QueryFormMetric[],
  formatterKey: string,
  forcePercentFormat: boolean,
) => {
  if (forcePercentFormat) {
    return getNumberFormatter(',.0%');
  }
  return (
    getCustomFormatter(customFormatters, metrics, formatterKey) ??
    defaultFormatter
  );
};

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
    theme,
    inContextMenu,
    emitCrossFilters,
  } = chartProps;

  let focusedSeries: string | null = null;

  const {
    verboseMap = {},
    currencyFormats = {},
    columnFormats = {},
  } = datasource;
  const { label_map: labelMap } =
    queriesData[0] as TimeseriesChartDataResponseResult;
  const { label_map: labelMapB } =
    queriesData[1] as TimeseriesChartDataResponseResult;
  const data1 = (queriesData[0].data || []) as TimeseriesDataRecord[];
  const data2 = (queriesData[1].data || []) as TimeseriesDataRecord[];
  const annotationData = getAnnotationData(chartProps);
  const coltypeMapping = {
    ...getColtypesMapping(queriesData[0]),
    ...getColtypesMapping(queriesData[1]),
  };
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
    currencyFormat,
    yAxisFormatSecondary,
    currencyFormatSecondary,
    xAxisTimeFormat,
    yAxisBounds,
    yAxisBoundsSecondary,
    yAxisIndex,
    yAxisIndexB,
    yAxisTitleSecondary,
    zoomable,
    richTooltip,
    tooltipSortByMetric,
    xAxisLabelRotation,
    groupby,
    groupbyB,
    xAxis: xAxisOrig,
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
    sliceId,
    timeGrainSqla,
    percentageThreshold,
    metrics = [],
    metricsB = [],
  }: EchartsMixedTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const refs: Refs = {};
  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);

  let xAxisLabel = getXAxisLabel(
    chartProps.rawFormData as QueryFormData,
  ) as string;
  if (
    isPhysicalColumn(chartProps.rawFormData?.x_axis) &&
    isDefined(verboseMap[xAxisLabel])
  ) {
    xAxisLabel = verboseMap[xAxisLabel];
  }

  const rebasedDataA = rebaseForecastDatum(data1, verboseMap);
  const [rawSeriesA] = extractSeries(rebasedDataA, {
    fillNeighborValue: stack ? 0 : undefined,
    xAxis: xAxisLabel,
  });
  const rebasedDataB = rebaseForecastDatum(data2, verboseMap);
  const [rawSeriesB] = extractSeries(rebasedDataB, {
    fillNeighborValue: stackB ? 0 : undefined,
    xAxis: xAxisLabel,
  });

  const dataTypes = getColtypesMapping(queriesData[0]);
  const xAxisDataType = dataTypes?.[xAxisLabel] ?? dataTypes?.[xAxisOrig];
  const xAxisType = getAxisType(stack, xAxisDataType);
  const series: SeriesOption[] = [];
  const formatter = contributionMode
    ? getNumberFormatter(',.0%')
    : currencyFormat?.symbol
    ? new CurrencyFormatter({ d3Format: yAxisFormat, currency: currencyFormat })
    : getNumberFormatter(yAxisFormat);
  const formatterSecondary = contributionMode
    ? getNumberFormatter(',.0%')
    : currencyFormatSecondary?.symbol
    ? new CurrencyFormatter({
        d3Format: yAxisFormatSecondary,
        currency: currencyFormatSecondary,
      })
    : getNumberFormatter(yAxisFormatSecondary);
  const customFormatters = buildCustomFormatters(
    [...ensureIsArray(metrics), ...ensureIsArray(metricsB)],
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );
  const customFormattersSecondary = buildCustomFormatters(
    [...ensureIsArray(metrics), ...ensureIsArray(metricsB)],
    currencyFormats,
    columnFormats,
    yAxisFormatSecondary,
    currencyFormatSecondary,
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
  const showValueIndexesA = extractShowValueIndexes(rawSeriesA, {
    stack,
  });
  const showValueIndexesB = extractShowValueIndexes(rawSeriesB, {
    stack,
  });
  const { totalStackedValues, thresholdValues } = extractDataTotalValues(
    rebasedDataA,
    {
      stack,
      percentageThreshold,
      xAxisCol: xAxisLabel,
    },
  );
  const {
    totalStackedValues: totalStackedValuesB,
    thresholdValues: thresholdValuesB,
  } = extractDataTotalValues(rebasedDataB, {
    stack: Boolean(stackB),
    percentageThreshold,
    xAxisCol: xAxisLabel,
  });

  annotationLayers
    .filter((layer: AnnotationLayer) => layer.show)
    .forEach((layer: AnnotationLayer) => {
      if (isFormulaAnnotationLayer(layer))
        series.push(
          transformFormulaAnnotation(
            layer,
            data1,
            xAxisLabel,
            xAxisType,
            colorScale,
            sliceId,
          ),
        );
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data1,
            annotationData,
            colorScale,
            theme,
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
            theme,
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
            colorScale,
            sliceId,
          ),
        );
      }
    });

  // yAxisBounds need to be parsed to replace incompatible values with undefined
  let [min, max] = (yAxisBounds || []).map(parseAxisBound);
  let [minSecondary, maxSecondary] = (yAxisBoundsSecondary || []).map(
    parseAxisBound,
  );

  const array = ensureIsArray(chartProps.rawFormData?.time_compare);
  const inverted = invert(verboseMap);

  rawSeriesA.forEach(entry => {
    const entryName = String(entry.name || '');
    const seriesName = inverted[entryName] || entryName;
    const colorScaleKey = getOriginalSeries(seriesName, array);

    const seriesFormatter = getFormatter(
      customFormatters,
      formatter,
      metrics,
      labelMap[seriesName]?.[0],
      !!contributionMode,
    );

    const transformedSeries = transformSeries(
      entry,
      colorScale,
      colorScaleKey,
      {
        area,
        markerEnabled,
        markerSize,
        areaOpacity: opacity,
        seriesType,
        showValue,
        stack: Boolean(stack),
        yAxisIndex,
        filterState,
        seriesKey: entry.name,
        sliceId,
        queryIndex: 0,
        formatter:
          seriesType === EchartsTimeseriesSeriesType.Bar
            ? getOverMaxHiddenFormatter({
                max,
                formatter: seriesFormatter,
              })
            : seriesFormatter,
        showValueIndexes: showValueIndexesA,
        totalStackedValues,
        thresholdValues,
      },
    );
    if (transformedSeries) series.push(transformedSeries);
  });

  rawSeriesB.forEach(entry => {
    const entryName = String(entry.name || '');
    const seriesName = `${inverted[entryName] || entryName} (1)`;
    const colorScaleKey = getOriginalSeries(seriesName, array);

    const seriesFormatter = getFormatter(
      customFormattersSecondary,
      formatterSecondary,
      metricsB,
      labelMapB[seriesName]?.[0],
      !!contributionMode,
    );

    const transformedSeries = transformSeries(
      entry,
      colorScale,
      colorScaleKey,
      {
        area: areaB,
        markerEnabled: markerEnabledB,
        markerSize: markerSizeB,
        areaOpacity: opacityB,
        seriesType: seriesTypeB,
        showValue: showValueB,
        stack: Boolean(stackB),
        yAxisIndex: yAxisIndexB,
        filterState,
        seriesKey: primarySeries.has(entry.name as string)
          ? `${entry.name} (1)`
          : entry.name,
        sliceId,
        queryIndex: 1,
        formatter:
          seriesTypeB === EchartsTimeseriesSeriesType.Bar
            ? getOverMaxHiddenFormatter({
                max: maxSecondary,
                formatter: seriesFormatter,
              })
            : seriesFormatter,
        showValueIndexes: showValueIndexesB,
        totalStackedValues: totalStackedValuesB,
        thresholdValues: thresholdValuesB,
      },
    );
    if (transformedSeries) series.push(transformedSeries);
  });

  // default to 0-100% range when doing row-level contribution chart
  if (contributionMode === 'row' && stack) {
    if (min === undefined) min = 0;
    if (max === undefined) max = 1;
    if (minSecondary === undefined) minSecondary = 0;
    if (maxSecondary === undefined) maxSecondary = 1;
  }

  const tooltipFormatter =
    xAxisDataType === GenericDataType.TEMPORAL
      ? getTooltipTimeFormatter(tooltipTimeFormat)
      : String;
  const xAxisFormatter =
    xAxisDataType === GenericDataType.TEMPORAL
      ? getXAxisFormatter(xAxisTimeFormat)
      : String;

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

  const { setDataMask = () => {}, onContextMenu } = hooks;
  const alignTicks = yAxisIndex !== yAxisIndexB;

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...chartPadding,
    },
    xAxis: {
      type: xAxisType,
      name: xAxisTitle,
      nameGap: convertInteger(xAxisTitleMargin),
      nameLocation: 'middle',
      axisLabel: {
        formatter: xAxisFormatter,
        rotate: xAxisLabelRotation,
      },
      minInterval:
        xAxisType === 'time' && timeGrainSqla
          ? TIMEGRAIN_TO_TIMESTAMP[timeGrainSqla]
          : 0,
    },
    yAxis: [
      {
        ...defaultYAxis,
        type: logAxis ? 'log' : 'value',
        min,
        max,
        minorTick: { show: true },
        minorSplitLine: { show: minorSplitLine },
        axisLabel: {
          formatter: getYAxisFormatter(
            metrics,
            !!contributionMode,
            customFormatters,
            formatter,
          ),
        },
        scale: truncateYAxis,
        name: yAxisTitle,
        nameGap: convertInteger(yAxisTitleMargin),
        nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
        alignTicks,
      },
      {
        ...defaultYAxis,
        type: logAxisSecondary ? 'log' : 'value',
        min: minSecondary,
        max: maxSecondary,
        minorTick: { show: true },
        splitLine: { show: false },
        minorSplitLine: { show: minorSplitLine },
        axisLabel: {
          formatter: getYAxisFormatter(
            metricsB,
            !!contributionMode,
            customFormattersSecondary,
            formatterSecondary,
          ),
        },
        scale: truncateYAxis,
        name: yAxisTitleSecondary,
        alignTicks,
      },
    ],
    tooltip: {
      ...getDefaultTooltip(refs),
      show: !inContextMenu,
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
        const forecastValues =
          extractForecastValuesFromTooltipParams(forecastValue);

        Object.keys(forecastValues).forEach(key => {
          const value = forecastValues[key];
          // if there are no dimensions, key is a verbose name of a metric,
          // otherwise it is a comma separated string where the first part is metric name
          let formatterKey;
          if (primarySeries.has(key)) {
            formatterKey =
              groupby.length === 0 ? inverted[key] : labelMap[key]?.[0];
          } else {
            formatterKey =
              groupbyB.length === 0 ? inverted[key] : labelMapB[key]?.[0];
          }
          const tooltipFormatter = getFormatter(
            customFormatters,
            formatter,
            metrics,
            formatterKey,
            !!contributionMode,
          );
          const tooltipFormatterSecondary = getFormatter(
            customFormattersSecondary,
            formatterSecondary,
            metricsB,
            formatterKey,
            !!contributionMode,
          );
          const content = formatForecastTooltipSeries({
            ...value,
            seriesName: key,
            formatter: primarySeries.has(key)
              ? tooltipFormatter
              : tooltipFormatterSecondary,
          });
          const contentStyle =
            key === focusedSeries ? 'font-weight: 700' : 'opacity: 0.7';
          rows.push(`<span style="${contentStyle}">${content}</span>`);
        });
        return rows.join('<br />');
      },
    },
    legend: {
      ...getLegendProps(
        legendType,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
      ),
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

  const onFocusedSeries = (seriesName: string | null) => {
    focusedSeries = seriesName;
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitCrossFilters,
    labelMap,
    labelMapB,
    groupby,
    groupbyB,
    seriesBreakdown: rawSeriesA.length,
    selectedValues: filterState.selectedValues || [],
    onContextMenu,
    onFocusedSeries,
    xValueFormatter: tooltipFormatter,
    xAxis: {
      label: xAxisLabel,
      type: xAxisType,
    },
    refs,
    coltypeMapping,
  };
}
