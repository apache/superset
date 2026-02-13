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
import { t } from '@apache-superset/core';
import {
  AnnotationLayer,
  AxisType,
  buildCustomFormatters,
  CategoricalColorNamespace,
  CurrencyFormatter,
  ensureIsArray,
  tooltipHtml,
  getCustomFormatter,
  getMetricLabel,
  getNumberFormatter,
  getXAxisLabel,
  isDefined,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isPhysicalColumn,
  isTimeseriesAnnotationLayer,
  resolveAutoCurrency,
  TimeseriesChartDataResponseResult,
  TimeseriesDataRecord,
  NumberFormats,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  extractExtraMetrics,
  getOriginalSeries,
  getTimeOffset,
  isDerivedSeries,
} from '@superset-ui/chart-controls';
import type { EChartsCoreOption } from 'echarts/core';
import type {
  LineStyleOption,
  CallbackDataParams,
} from 'echarts/types/src/util/types';
import type { SeriesOption } from 'echarts';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
  OrientationType,
  TimeseriesChartTransformedProps,
} from './types';
import { DEFAULT_FORM_DATA } from './constants';
import { ForecastSeriesEnum, ForecastValue, Refs } from '../types';
import { parseAxisBound } from '../utils/controls';
import {
  calculateLowerLogTick,
  dedupSeries,
  extractDataTotalValues,
  extractSeries,
  extractShowValueIndexes,
  extractTooltipKeys,
  getAxisType,
  getColtypesMapping,
  getLegendProps,
  getMinAndMaxFromBounds,
} from '../utils/series';
import {
  extractAnnotationLabels,
  getAnnotationData,
} from '../utils/annotation';
import {
  extractForecastSeriesContext,
  extractForecastSeriesContexts,
  extractForecastValuesFromTooltipParams,
  formatForecastTooltipSeries,
  rebaseForecastDatum,
  reorderForecastSeries,
} from '../utils/forecast';
import { convertInteger } from '../utils/convertInteger';
import { defaultGrid, defaultYAxis } from '../defaults';
import {
  getBaselineSeriesForStream,
  getPadding,
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformSeries,
  transformTimeseriesAnnotation,
} from './transformers';
import {
  OpacityEnum,
  StackControlsValue,
  TIMEGRAIN_TO_TIMESTAMP,
  TIMESERIES_CONSTANTS,
} from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import {
  getPercentFormatter,
  getTooltipTimeFormatter,
  getXAxisFormatter,
  getYAxisFormatter,
} from '../utils/formatters';

export default function transformProps(
  chartProps: EchartsTimeseriesChartProps,
): TimeseriesChartTransformedProps {
  const {
    width,
    height,
    filterState,
    legendState,
    formData,
    hooks,
    queriesData,
    datasource,
    theme,
    inContextMenu,
    emitCrossFilters,
    legendIndex,
  } = chartProps;

  let focusedSeries: string | null = null;

  const {
    verboseMap = {},
    columnFormats = {},
    currencyFormats = {},
    currencyCodeColumn,
  } = datasource;
  const [queryData] = queriesData;
  const {
    data = [],
    label_map = {},
    detected_currency: backendDetectedCurrency,
  } = queryData as TimeseriesChartDataResponseResult;

  const dataTypes = getColtypesMapping(queryData);
  const annotationData = getAnnotationData(chartProps);

  const {
    area,
    annotationLayers,
    colorScheme,
    contributionMode,
    forecastEnabled,
    groupby,
    legendOrientation,
    legendType,
    legendMargin,
    legendSort,
    logAxis,
    markerEnabled,
    markerSize,
    metrics,
    minorSplitLine,
    minorTicks,
    onlyTotal,
    opacity,
    orientation,
    percentageThreshold,
    richTooltip,
    seriesType,
    showLegend,
    showValue,
    sliceId,
    sortSeriesType,
    sortSeriesAscending,
    timeGrainSqla,
    forceMaxInterval,
    timeCompare,
    timeShiftColor,
    stack,
    tooltipTimeFormat,
    tooltipSortByMetric,
    showTooltipTotal,
    showTooltipPercentage,
    truncateXAxis,
    truncateYAxis,
    xAxis: xAxisOrig,
    xAxisBounds,
    xAxisForceCategorical,
    xAxisLabelRotation,
    xAxisLabelInterval,
    xAxisSort,
    xAxisSortAsc,
    xAxisTimeFormat,
    xAxisNumberFormat,
    xAxisTitle,
    xAxisTitleMargin,
    yAxisBounds,
    yAxisFormat,
    currencyFormat,
    yAxisTitle,
    yAxisTitleMargin,
    yAxisTitlePosition,
    zoomable,
    stackDimension,
  }: EchartsTimeseriesFormData = { ...DEFAULT_FORM_DATA, ...formData };

  const refs: Refs = {};
  const groupBy = ensureIsArray(groupby);
  const labelMap: { [key: string]: string[] } = Object.entries(
    label_map,
  ).reduce((acc, entry) => {
    if (
      entry[1].length > groupBy.length &&
      Array.isArray(timeCompare) &&
      timeCompare.includes(entry[1][0])
    ) {
      entry[1].shift();
    }
    return { ...acc, [entry[0]]: entry[1] };
  }, {});
  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);
  const rebasedData = rebaseForecastDatum(data, verboseMap);
  let xAxisLabel = getXAxisLabel(chartProps.rawFormData) as string;
  if (
    isPhysicalColumn(chartProps.rawFormData?.x_axis) &&
    isDefined(verboseMap[xAxisLabel])
  ) {
    xAxisLabel = verboseMap[xAxisLabel];
  }
  const isHorizontal = orientation === OrientationType.Horizontal;
  const { totalStackedValues, thresholdValues } = extractDataTotalValues(
    rebasedData,
    {
      stack,
      percentageThreshold,
      xAxisCol: xAxisLabel,
      legendState,
    },
  );
  const extraMetricLabels = extractExtraMetrics(chartProps.rawFormData).map(
    getMetricLabel,
  );

  const isMultiSeries = groupBy.length || metrics?.length > 1;
  const xAxisDataType = dataTypes?.[xAxisLabel] ?? dataTypes?.[xAxisOrig];
  const xAxisType = getAxisType(stack, xAxisForceCategorical, xAxisDataType);

  const [rawSeries, sortedTotalValues, minPositiveValue] = extractSeries(
    rebasedData,
    {
      fillNeighborValue: stack && !forecastEnabled ? 0 : undefined,
      xAxis: xAxisLabel,
      extraMetricLabels,
      stack,
      totalStackedValues,
      isHorizontal,
      sortSeriesType,
      sortSeriesAscending,
      xAxisSortSeries: isMultiSeries ? xAxisSort : undefined,
      xAxisSortSeriesAscending: isMultiSeries ? xAxisSortAsc : undefined,
      xAxisType,
    },
  );
  const showValueIndexes = extractShowValueIndexes(rawSeries, {
    stack,
    onlyTotal,
    isHorizontal,
    legendState,
  });
  const seriesContexts = extractForecastSeriesContexts(
    rawSeries.map(series => series.name as string),
  );
  const isAreaExpand = stack === StackControlsValue.Expand;
  const series: SeriesOption[] = [];

  const forcePercentFormatter = Boolean(contributionMode || isAreaExpand);
  const percentFormatter = forcePercentFormatter
    ? getPercentFormatter(yAxisFormat)
    : getPercentFormatter(NumberFormats.PERCENT_2_POINT);

  // Resolve currency for AUTO mode (backend detection takes precedence)
  const resolvedCurrency = resolveAutoCurrency(
    currencyFormat,
    backendDetectedCurrency,
    data,
    currencyCodeColumn,
  );

  const defaultFormatter = resolvedCurrency?.symbol
    ? new CurrencyFormatter({
        d3Format: yAxisFormat,
        currency: resolvedCurrency,
      })
    : getNumberFormatter(yAxisFormat);
  const customFormatters = buildCustomFormatters(
    metrics,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    resolvedCurrency,
    data,
    currencyCodeColumn,
  );

  const array = ensureIsArray(chartProps.rawFormData?.time_compare);
  const inverted = invert(verboseMap);

  const offsetLineWidths: { [key: string]: number } = {};

  // For horizontal bar charts, calculate min/max from data to avoid cutting off labels
  const shouldCalculateDataBounds =
    isHorizontal &&
    seriesType === EchartsTimeseriesSeriesType.Bar &&
    truncateYAxis;
  let dataMax: number | undefined;
  let dataMin: number | undefined;

  rawSeries.forEach(entry => {
    const entryName = String(entry.name || '');
    const seriesName = inverted[entryName] || entryName;
    // isDerivedSeries checks for time comparison series patterns:
    // - "metric__1 day ago" pattern (via hasTimeOffset)
    // - "1 day ago, groupby" pattern (via hasTimeOffset)
    // - exact match "1 day ago" (via seriesName parameter)
    const derivedSeries = isDerivedSeries(
      entry,
      chartProps.rawFormData,
      seriesName,
    );
    const lineStyle: LineStyleOption = {};
    if (derivedSeries) {
      // Get the time offset for this series to assign different dash patterns
      const offset = getTimeOffset(entry, array) || seriesName;
      if (!offsetLineWidths[offset]) {
        offsetLineWidths[offset] = Object.keys(offsetLineWidths).length + 1;
      }
      // Use visible dash patterns that vary by offset index
      // Pattern: [dash length, gap length] - scaled to be clearly visible
      const patternIndex = offsetLineWidths[offset];
      lineStyle.type = [
        (patternIndex % 5) + 4, // dash: 4-8px (visible)
        (patternIndex % 3) + 3, // gap: 3-5px (visible)
      ];
      lineStyle.opacity = OpacityEnum.DerivedSeries;
    }

    // Calculate min/max from data for horizontal bar charts
    if (shouldCalculateDataBounds && entry.data && Array.isArray(entry.data)) {
      (entry.data as [number, any][]).forEach((datum: [number, any]) => {
        const value = datum[0];
        if (typeof value === 'number' && !Number.isNaN(value)) {
          if (dataMax === undefined || value > dataMax) {
            dataMax = value;
          }
          if (dataMin === undefined || value < dataMin) {
            dataMin = value;
          }
        }
      });
    }

    let colorScaleKey = getOriginalSeries(seriesName, array);

    // If series name exactly matches a time offset (single metric case),
    // find the original series for color matching
    if (derivedSeries && array.includes(seriesName)) {
      const originalSeries = rawSeries.find(
        s =>
          !isDerivedSeries(
            s,
            chartProps.rawFormData,
            inverted[String(s.name || '')] || String(s.name || ''),
          ),
      );
      if (originalSeries) {
        const originalSeriesName =
          inverted[String(originalSeries.name || '')] ||
          String(originalSeries.name || '');
        colorScaleKey = getOriginalSeries(originalSeriesName, array);
      }
    }

    const transformedSeries = transformSeries(
      entry,
      colorScale,
      colorScaleKey,
      {
        area,
        connectNulls: derivedSeries,
        filterState,
        seriesContexts,
        markerEnabled,
        markerSize,
        areaOpacity: opacity,
        seriesType,
        legendState,
        stack,
        formatter: forcePercentFormatter
          ? percentFormatter
          : (getCustomFormatter(
              customFormatters,
              metrics,
              labelMap?.[seriesName]?.[0],
            ) ?? defaultFormatter),
        showValue,
        onlyTotal,
        totalStackedValues: sortedTotalValues,
        showValueIndexes,
        thresholdValues,
        richTooltip,
        sliceId,
        isHorizontal,
        lineStyle,
        timeCompare: array,
        timeShiftColor,
        theme,
        hasDimensions: (groupBy?.length ?? 0) > 0,
      },
    );
    if (transformedSeries) {
      if (stack === StackControlsValue.Stream) {
        // bug in Echarts - `stackStrategy: 'all'` doesn't work with nulls, so we cast them to 0
        series.push({
          ...transformedSeries,
          data: (transformedSeries.data as any).map(
            (row: [string | number, number]) => [row[0], row[1] ?? 0],
          ),
        });
      } else {
        series.push(transformedSeries);
      }
    }
  });

  if (stack === StackControlsValue.Stream) {
    const baselineSeries = getBaselineSeriesForStream(
      series.map(entry => entry.data) as [string | number, number][][],
      seriesType,
    );

    series.unshift(baselineSeries);
  }
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
          transformFormulaAnnotation(
            layer,
            rebasedData as TimeseriesDataRecord[],
            xAxisLabel,
            xAxisType,
            colorScale,
            sliceId,
            orientation,
          ),
        );
      else if (isIntervalAnnotationLayer(layer)) {
        series.push(
          ...transformIntervalAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
            orientation,
          ),
        );
      } else if (isEventAnnotationLayer(layer)) {
        series.push(
          ...transformEventAnnotation(
            layer,
            data,
            annotationData,
            colorScale,
            theme,
            sliceId,
            orientation,
          ),
        );
      } else if (isTimeseriesAnnotationLayer(layer)) {
        series.push(
          ...transformTimeseriesAnnotation(
            layer,
            markerSize,
            data,
            annotationData,
            colorScale,
            sliceId,
            orientation,
          ),
        );
      }
    });

  if (
    stack === StackControlsValue.Stack &&
    stackDimension &&
    chartProps.rawFormData.groupby
  ) {
    const idxSelectedDimension =
      formData.metrics.length > 1
        ? 1
        : 0 + chartProps.rawFormData.groupby.indexOf(stackDimension);
    for (const s of series) {
      if (s.id) {
        const columnsArr = labelMap[s.id];
        (s as any).stack = columnsArr[idxSelectedDimension];
      }
    }
  }

  // axis bounds need to be parsed to replace incompatible values with undefined
  const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
  let [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);

  // default to 0-100% range when doing row-level contribution chart
  if ((contributionMode === 'row' || isAreaExpand) && stack) {
    if (yAxisMin === undefined) yAxisMin = 0;
    if (yAxisMax === undefined) yAxisMax = 1;
  } else if (
    logAxis &&
    yAxisMin === undefined &&
    minPositiveValue !== undefined
  ) {
    yAxisMin = calculateLowerLogTick(minPositiveValue);
  }

  // For horizontal bar charts, set max/min from calculated data bounds
  if (shouldCalculateDataBounds) {
    // Set max to actual data max to avoid gaps and ensure labels are visible
    if (dataMax !== undefined && yAxisMax === undefined) {
      yAxisMax = dataMax;
    }
    // Set min to actual data min for diverging bars
    if (dataMin !== undefined && yAxisMin === undefined && dataMin < 0) {
      yAxisMin = dataMin;
    }
  }

  const tooltipFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getTooltipTimeFormatter(tooltipTimeFormat)
      : String;
  const xAxisFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getXAxisFormatter(xAxisTimeFormat)
      : xAxisDataType === GenericDataType.Numeric
        ? getNumberFormatter(xAxisNumberFormat)
        : String;

  const {
    setDataMask = () => {},
    setControlValue = () => {},
    onContextMenu,
    onLegendStateChanged,
    onLegendScroll,
  } = hooks;

  const addYAxisLabelOffset =
    !!yAxisTitle && convertInteger(yAxisTitleMargin) !== 0;
  const addXAxisLabelOffset =
    !!xAxisTitle && convertInteger(xAxisTitleMargin) !== 0;
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
    isHorizontal,
  );

  const legendData = rawSeries
    .filter(
      entry =>
        extractForecastSeriesContext(entry.name || '').type ===
        ForecastSeriesEnum.Observation,
    )
    .map(entry => entry.name || '')
    .concat(extractAnnotationLabels(annotationLayers));

  let xAxis: any = {
    type: xAxisType,
    name: xAxisTitle,
    nameGap: convertInteger(xAxisTitleMargin),
    nameLocation: 'middle',
    axisLabel: {
      hideOverlap: true,
      formatter: xAxisFormatter,
      rotate: xAxisLabelRotation,
      interval: xAxisLabelInterval,
      ...(xAxisType === AxisType.Time && {
        showMaxLabel: true,
        alignMaxLabel: 'right',
      }),
    },
    minorTick: { show: minorTicks },
    minInterval:
      xAxisType === AxisType.Time && timeGrainSqla && !forceMaxInterval
        ? TIMEGRAIN_TO_TIMESTAMP[
            timeGrainSqla as keyof typeof TIMEGRAIN_TO_TIMESTAMP
          ]
        : 0,
    maxInterval:
      xAxisType === AxisType.Time && timeGrainSqla && forceMaxInterval
        ? TIMEGRAIN_TO_TIMESTAMP[
            timeGrainSqla as keyof typeof TIMEGRAIN_TO_TIMESTAMP
          ]
        : undefined,
    ...getMinAndMaxFromBounds(
      xAxisType,
      truncateXAxis,
      xAxisMin,
      xAxisMax,
      seriesType,
    ),
  };

  let yAxis: any = {
    ...defaultYAxis,
    type: logAxis ? AxisType.Log : AxisType.Value,
    min: yAxisMin,
    max: yAxisMax,
    minorTick: { show: minorTicks },
    minorSplitLine: { show: minorSplitLine },
    axisLabel: {
      formatter: getYAxisFormatter(
        metrics,
        forcePercentFormatter,
        customFormatters,
        defaultFormatter,
        yAxisFormat,
      ),
    },
    scale: truncateYAxis,
    name: yAxisTitle,
    nameGap: convertInteger(yAxisTitleMargin),
    nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
  };

  if (isHorizontal) {
    [xAxis, yAxis] = [yAxis, xAxis];
    [padding.bottom, padding.left] = [padding.left, padding.bottom];
    // Increase right padding for horizontal bar charts to ensure value labels are visible
    if (seriesType === EchartsTimeseriesSeriesType.Bar && showValue) {
      padding.right = Math.max(
        padding.right || 0,
        TIMESERIES_CONSTANTS.horizontalBarLabelRightPadding,
      );
    }
  }

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    grid: {
      ...defaultGrid,
      ...padding,
    },
    xAxis,
    yAxis,
    tooltip: {
      ...getDefaultTooltip(refs),
      show: !inContextMenu,
      trigger: richTooltip ? 'axis' : 'item',
      formatter: (params: any) => {
        const [xIndex, yIndex] = isHorizontal ? [1, 0] : [0, 1];
        // For axis tooltips, prefer axisValue/axisValueLabel which contains the full label
        // even when the axis label is visually truncated
        const xValue: number = richTooltip
          ? (params[0].axisValue ??
            params[0].axisValueLabel ??
            params[0].value[xIndex])
          : params.value[xIndex];
        const forecastValue: CallbackDataParams[] = richTooltip
          ? params
          : [params];
        const sortedKeys = extractTooltipKeys(
          forecastValue,
          yIndex,
          richTooltip,
          tooltipSortByMetric,
        );
        const filteredForecastValue = forecastValue.filter(
          (item: CallbackDataParams) =>
            !annotationLayers.some(
              (annotation: AnnotationLayer) =>
                item.seriesName === annotation.name,
            ),
        );
        const forecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(forecastValue, isHorizontal);

        const filteredForecastValues: Record<string, ForecastValue> =
          extractForecastValuesFromTooltipParams(
            filteredForecastValue,
            isHorizontal,
          );

        const isForecast = Object.values(forecastValues).some(
          value =>
            value.forecastTrend || value.forecastLower || value.forecastUpper,
        );

        const formatter = forcePercentFormatter
          ? percentFormatter
          : (getCustomFormatter(customFormatters, metrics) ?? defaultFormatter);

        const rows: string[][] = [];
        const total = Object.values(filteredForecastValues).reduce(
          (acc, value) =>
            value.observation !== undefined ? acc + value.observation : acc,
          0,
        );
        const allowTotal = Boolean(isMultiSeries) && richTooltip && !isForecast;
        const showPercentage =
          allowTotal && !forcePercentFormatter && showTooltipPercentage;
        const keys = Object.keys(forecastValues);
        let focusedRow;
        sortedKeys
          .filter(key => keys.includes(key))
          .forEach(key => {
            const value = forecastValues[key];
            if (value.observation === 0 && stack) {
              return;
            }
            const row = formatForecastTooltipSeries({
              ...value,
              seriesName: key,
              formatter,
            });

            const annotationRow = annotationLayers.some(
              item => item.name === key,
            );

            if (
              showPercentage &&
              value.observation !== undefined &&
              !annotationRow
            ) {
              row.push(
                percentFormatter.format(value.observation / (total || 1)),
              );
            }
            rows.push(row);
            if (key === focusedSeries) {
              focusedRow = rows.length - 1;
            }
          });
        if (stack) {
          rows.reverse();
          if (focusedRow !== undefined) {
            focusedRow = rows.length - focusedRow - 1;
          }
        }
        if (allowTotal && showTooltipTotal) {
          const totalRow = ['Total', formatter.format(total)];
          if (showPercentage) {
            totalRow.push(percentFormatter.format(1));
          }
          rows.push(totalRow);
        }
        return tooltipHtml(rows, tooltipFormatter(xValue), focusedRow);
      },
    },
    legend: {
      ...getLegendProps(
        legendType,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
        legendState,
        padding,
      ),
      scrollDataIndex: legendIndex || 0,
      data: legendData.sort((a: string, b: string) => {
        if (!legendSort) return 0;
        return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
      }) as string[],
    },
    series: dedupSeries(reorderForecastSeries(series) as SeriesOption[]),
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          ...(stack ? { yAxisIndex: false } : {}), // disable y-axis zoom for stacked charts
          title: {
            zoom: t('zoom area'),
            back: t('restore zoom'),
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
            yAxisIndex: isHorizontal ? 0 : undefined,
          },
          {
            type: 'inside',
            yAxisIndex: 0,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
          },
          {
            type: 'inside',
            xAxisIndex: 0,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
          },
        ]
      : [],
  };

  const onFocusedSeries = (seriesName: string | null) => {
    focusedSeries = seriesName;
  };
  return {
    echartOptions,
    emitCrossFilters,
    formData,
    groupby: groupBy,
    height,
    labelMap,
    selectedValues,
    setDataMask,
    setControlValue,
    width,
    legendData,
    onContextMenu,
    onLegendStateChanged,
    onFocusedSeries,
    xValueFormatter: tooltipFormatter,
    xAxis: {
      label: xAxisLabel,
      type: xAxisType,
    },
    refs,
    coltypeMapping: dataTypes,
    onLegendScroll,
  };
}
