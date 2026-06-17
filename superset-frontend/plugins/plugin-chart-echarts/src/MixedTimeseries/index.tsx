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

/**
 * Mixed Timeseries Chart - Glyph Pattern Implementation
 *
 * Visualize two different series using the same x-axis. Note that
 * both series can be visualized with a different chart type
 * (e.g. 1 using bars and 1 using a line).
 *
 * Key characteristics:
 * - Two independent queries (A and B) with separate metrics/groupby
 * - Dual y-axes (primary and secondary) with independent formatting
 * - Per-query series type, stack, area, markers, opacity, sort order
 * - Per-query y-axis assignment (primary or secondary)
 * - Custom buildQuery that splits form data by `_b` suffix
 * - queryObjectCount: 2
 * - No orientation (horizontal mode not supported)
 * - No ExtraControls / stack radio buttons
 * - Supports cross-filtering, drill-to-detail, and drill-by
 * - Supports annotations (event, formula, interval, timeseries)
 */

import { useCallback } from 'react';
import { invert, cloneDeep } from 'lodash';
import { t } from '@apache-superset/core/translation';
import {
  AnnotationLayer,
  AnnotationType,
  AxisType,
  Behavior,
  BinaryQueryObjectFilterClause,
  buildCustomFormatters,
  CategoricalColorNamespace,
  ChartProps,
  CurrencyFormatter,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  getColumnLabel,
  getCustomFormatter,
  getNumberFormatter,
  getTimeFormatter,
  getXAxisLabel,
  isDefined,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isPhysicalColumn,
  isTimeseriesAnnotationLayer,
  QueryFormData,
  QueryFormMetric,
  TimeseriesChartDataResponseResult,
  TimeseriesDataRecord,
  tooltipHtml,
  ValueFormatter,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ControlPanelSectionConfig,
  ControlPanelsContainerProps,
  ControlSetRow,
  ControlSubSectionHeader,
  CustomControlItem,
  DEFAULT_SORT_SERIES_DATA,
  getOriginalSeries,
  getStandardizedControls,
  sections,
  sharedControls,
  SORT_SERIES_CHOICES,
} from '@superset-ui/chart-controls';
import type { EChartsCoreOption } from 'echarts/core';
import type { SeriesOption } from 'echarts';

import { defineChart } from '@superset-ui/glyph-core';
import {
  EchartsTimeseriesSeriesType,
  ForecastSeriesEnum,
  Refs,
} from '../types';
import { EventHandlers } from '../types';
import Echart from '../components/Echart';
import { formatSeriesName } from '../utils/series';
import { parseAxisBound } from '../utils/controls';
import {
  dedupSeries,
  extractDataTotalValues,
  extractSeries,
  extractShowValueIndexes,
  extractTooltipKeys,
  getAxisType,
  getColtypesMapping,
  getLegendProps,
  getMinAndMaxFromBounds,
  getOverMaxHiddenFormatter,
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
  reorderForecastSeries,
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
import { TIMEGRAIN_TO_TIMESTAMP, TIMESERIES_CONSTANTS } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import {
  getTooltipTimeFormatter,
  getXAxisFormatter,
  getYAxisFormatter,
} from '../utils/formatters';
import { getMetricDisplayName } from '../utils/metricDisplayName';
import {
  DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesChartTransformedProps,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesProps,
} from './types';
import buildQuery from './buildQuery';
import {
  legendSection,
  minorTicks,
  richTooltipSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
  xAxisLabelInterval,
  forceMaxInterval,
} from '../controls';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';

// ============================================================================
// Types
// ============================================================================

interface MixedTransformResult {
  transformedProps: EchartsMixedTimeseriesChartTransformedProps;
}

// ============================================================================
// Constants
// ============================================================================

const {
  area,
  logAxis,
  markerEnabled,
  markerSize,
  minorSplitLine,
  opacity,
  orderDesc,
  rowLimit,
  seriesType,
  showValue,
  stack,
  truncateYAxis,
  yAxisBounds,
  yAxisIndex,
} = DEFAULT_FORM_DATA;

// ============================================================================
// Control Panel Helpers
// ============================================================================

function createQuerySection(
  label: string,
  controlSuffix: string,
): ControlPanelSectionConfig {
  return {
    label,
    expanded: true,
    controlSetRows: [
      [
        {
          name: `metrics${controlSuffix}`,
          config: sharedControls.metrics,
        },
      ],
      [
        {
          name: `groupby${controlSuffix}`,
          config: sharedControls.groupby,
        },
      ],
      [
        {
          name: `adhoc_filters${controlSuffix}`,
          config: sharedControls.adhoc_filters,
        },
      ],
      [
        {
          name: `limit${controlSuffix}`,
          config: sharedControls.limit,
        },
      ],
      [
        {
          name: `timeseries_limit_metric${controlSuffix}`,
          config: sharedControls.timeseries_limit_metric,
        },
      ],
      [
        {
          name: `order_desc${controlSuffix}`,
          config: {
            type: 'CheckboxControl',
            label: t('Sort Descending'),
            default: orderDesc,
            description: t('Whether to sort descending or ascending'),
          },
        },
      ],
      [
        {
          name: `row_limit${controlSuffix}`,
          config: {
            ...sharedControls.row_limit,
            default: rowLimit,
          },
        },
      ],
      [
        {
          name: `truncate_metric${controlSuffix}`,
          config: {
            ...sharedControls.truncate_metric,
            default: sharedControls.truncate_metric.default,
          },
        },
      ],
    ],
  };
}

function createCustomizeSection(
  label: string,
  controlSuffix: string,
): ControlSetRow[] {
  return [
    [<ControlSubSectionHeader>{label}</ControlSubSectionHeader>],
    [
      {
        name: `seriesType${controlSuffix}`,
        config: {
          type: 'SelectControl',
          label: t('Series type'),
          renderTrigger: true,
          default: seriesType,
          choices: [
            [EchartsTimeseriesSeriesType.Line, t('Line')],
            [EchartsTimeseriesSeriesType.Scatter, t('Scatter')],
            [EchartsTimeseriesSeriesType.Smooth, t('Smooth Line')],
            [EchartsTimeseriesSeriesType.Bar, t('Bar')],
            [EchartsTimeseriesSeriesType.Start, t('Step - start')],
            [EchartsTimeseriesSeriesType.Middle, t('Step - middle')],
            [EchartsTimeseriesSeriesType.End, t('Step - end')],
          ],
          description: t('Series chart type (line, bar etc)'),
        },
      },
    ],
    [
      {
        name: `stack${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Stack series'),
          renderTrigger: true,
          default: stack,
          description: t('Stack series on top of each other'),
        },
      },
    ],
    [
      {
        name: `area${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Area chart'),
          renderTrigger: true,
          default: area,
          description: t(
            'Draw area under curves. Only applicable for line types.',
          ),
        },
      },
    ],
    [
      {
        name: `show_value${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Show Values'),
          renderTrigger: true,
          default: showValue,
          description: t(
            'Whether to display the numerical values within the cells',
          ),
        },
      },
    ],
    [
      {
        name: `only_total${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Only Total'),
          default: true,
          renderTrigger: true,
          description: t(
            'Only show the total value on the stacked chart, and not show on the selected category',
          ),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            Boolean(controls?.show_value?.value) &&
            Boolean(controls?.stack?.value),
        },
      },
    ],
    [
      {
        name: `opacity${controlSuffix}`,
        config: {
          type: 'SliderControl',
          label: t('Opacity'),
          renderTrigger: true,
          min: 0,
          max: 1,
          step: 0.1,
          default: opacity,
          description: t('Opacity of area chart.'),
        },
      },
    ],
    [
      {
        name: `markerEnabled${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Marker'),
          renderTrigger: true,
          default: markerEnabled,
          description: t(
            'Draw a marker on data points. Only applicable for line types.',
          ),
        },
      },
    ],
    [
      {
        name: `markerSize${controlSuffix}`,
        config: {
          type: 'SliderControl',
          label: t('Marker size'),
          renderTrigger: true,
          min: 0,
          max: 100,
          default: markerSize,
          description: t(
            'Size of marker. Also applies to forecast observations.',
          ),
        },
      },
    ],
    [
      {
        name: `yAxisIndex${controlSuffix}`,
        config: {
          type: 'SelectControl',
          label: t('Y Axis'),
          choices: [
            [0, t('Primary')],
            [1, t('Secondary')],
          ],
          default: yAxisIndex,
          clearable: false,
          renderTrigger: true,
          description: t('Primary or secondary y-axis'),
        },
      },
    ],
    [<ControlSubSectionHeader>{t('Series Order')}</ControlSubSectionHeader>],
    [
      {
        name: `sort_series_type${controlSuffix}`,
        config: {
          type: 'SelectControl',
          freeForm: false,
          label: t('Sort Series By'),
          choices: SORT_SERIES_CHOICES,
          default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
          renderTrigger: true,
          description: t(
            'Based on what should series be ordered on the chart and legend',
          ),
        },
      },
    ],
    [
      {
        name: `sort_series_ascending${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Sort Series Ascending'),
          default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
          renderTrigger: true,
          description: t('Sort series in ascending order'),
        },
      },
    ],
  ];
}

function createAdvancedAnalyticsSection(
  label: string,
  controlSuffix: string,
): ControlPanelSectionConfig {
  const aaWithSuffix = cloneDeep(sections.advancedAnalyticsControls);
  aaWithSuffix.label = label;
  if (!controlSuffix) {
    return aaWithSuffix;
  }
  aaWithSuffix.controlSetRows.forEach(row =>
    row.forEach((control: CustomControlItem) => {
      if (control?.name) {
        // eslint-disable-next-line no-param-reassign
        control.name = `${control.name}${controlSuffix}`;
      }
    }),
  );
  return aaWithSuffix;
}

// ============================================================================
// Transform Helpers
// ============================================================================

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

// ============================================================================
// Transform Function
// ============================================================================

function transformMixedProps(
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
    legendState,
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
    timeShiftColor,
    contributionMode,
    legendOrientation,
    legendMargin,
    legendType,
    legendSort,
    logAxis,
    logAxisSecondary,
    markerEnabled,
    markerEnabledB,
    markerSize,
    markerSizeB,
    opacity,
    opacityB,
    minorSplitLine,
    minorTicks,
    seriesType,
    seriesTypeB,
    showLegend,
    showValue,
    showValueB,
    onlyTotal,
    onlyTotalB,
    stack,
    stackB,
    truncateXAxis,
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
    xAxisBounds,
    xAxisLabelRotation,
    xAxisLabelInterval,
    groupby,
    groupbyB,
    xAxis: xAxisOrig,
    xAxisForceCategorical,
    xAxisTitle,
    yAxisTitle,
    xAxisTitleMargin,
    yAxisTitleMargin,
    yAxisTitlePosition,
    sliceId,
    sortSeriesType,
    sortSeriesTypeB,
    sortSeriesAscending,
    sortSeriesAscendingB,
    timeGrainSqla,
    forceMaxInterval,
    percentageThreshold,
    showQueryIdentifiers = false,
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
  const { totalStackedValues, thresholdValues } = extractDataTotalValues(
    rebasedDataA,
    {
      stack,
      percentageThreshold,
      xAxisCol: xAxisLabel,
    },
  );

  const MetricDisplayNameA = getMetricDisplayName(metrics[0], verboseMap);
  const MetricDisplayNameB = getMetricDisplayName(metricsB[0], verboseMap);

  const dataTypes = getColtypesMapping(queriesData[0]);
  const xAxisDataType = dataTypes?.[xAxisLabel] ?? dataTypes?.[xAxisOrig];
  const xAxisType = getAxisType(stack, xAxisForceCategorical, xAxisDataType);

  const [rawSeriesA, sortedTotalValuesA] = extractSeries(rebasedDataA, {
    fillNeighborValue: stack ? 0 : undefined,
    xAxis: xAxisLabel,
    sortSeriesType,
    sortSeriesAscending,
    stack,
    totalStackedValues,
    xAxisType,
  });
  const rebasedDataB = rebaseForecastDatum(data2, verboseMap);
  const {
    totalStackedValues: totalStackedValuesB,
    thresholdValues: thresholdValuesB,
  } = extractDataTotalValues(rebasedDataB, {
    stack: Boolean(stackB),
    percentageThreshold,
    xAxisCol: xAxisLabel,
  });
  const [rawSeriesB, sortedTotalValuesB] = extractSeries(rebasedDataB, {
    fillNeighborValue: stackB ? 0 : undefined,
    xAxis: xAxisLabel,
    sortSeriesType: sortSeriesTypeB,
    sortSeriesAscending: sortSeriesAscendingB,
    stack: Boolean(stackB),
    totalStackedValues: totalStackedValuesB,
    xAxisType,
  });
  const series: SeriesOption[] = [];
  const formatter = contributionMode
    ? getNumberFormatter(',.0%')
    : currencyFormat?.symbol
      ? new CurrencyFormatter({
          d3Format: yAxisFormat,
          currency: currencyFormat,
        })
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
  const showValueIndexesA = extractShowValueIndexes(rawSeriesA, {
    stack,
    onlyTotal,
  });
  const showValueIndexesB = extractShowValueIndexes(rawSeriesB, {
    stack,
    onlyTotal,
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

  const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
  let [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);
  let [minSecondary, maxSecondary] = (yAxisBoundsSecondary || []).map(
    parseAxisBound,
  );

  const array = ensureIsArray(chartProps.rawFormData?.time_compare);
  const inverted = invert(verboseMap);

  rawSeriesA.forEach(entry => {
    const entryName = String(entry.name || '');
    const seriesName = inverted[entryName] || entryName;
    const colorScaleKey = getOriginalSeries(seriesName, array);

    let displayName: string;

    if (groupby.length > 0) {
      const metricPart = showQueryIdentifiers
        ? `${MetricDisplayNameA} (Query A)`
        : MetricDisplayNameA;
      displayName = `${metricPart}, ${entryName}`;
    } else {
      displayName = showQueryIdentifiers ? `${entryName} (Query A)` : entryName;
    }

    const seriesFormatter = getFormatter(
      customFormatters,
      formatter,
      metrics,
      labelMap?.[seriesName]?.[0],
      !!contributionMode,
    );

    const transformedSeries = transformSeries(
      {
        ...entry,
        id: `${displayName || ''}`,
        name: `${displayName || ''}`,
      },
      colorScale,
      colorScaleKey,
      {
        area,
        markerEnabled,
        markerSize,
        areaOpacity: opacity,
        seriesType,
        showValue,
        onlyTotal,
        stack: Boolean(stack),
        stackIdSuffix: '\na',
        yAxisIndex,
        filterState,
        seriesKey: entry.name,
        sliceId,
        queryIndex: 0,
        formatter:
          seriesType === EchartsTimeseriesSeriesType.Bar
            ? getOverMaxHiddenFormatter({
                max: yAxisMax,
                formatter: seriesFormatter,
              })
            : seriesFormatter,
        totalStackedValues: sortedTotalValuesA,
        showValueIndexes: showValueIndexesA,
        thresholdValues,
        timeShiftColor,
        theme,
      },
    );

    if (transformedSeries) {
      series.push(transformedSeries);
      mapSeriesIdToAxis(transformedSeries, yAxisIndex);
    }
  });

  rawSeriesB.forEach(entry => {
    const entryName = String(entry.name || '');
    const seriesEntry = inverted[entryName] || entryName;
    const colorScaleKey = getOriginalSeries(seriesEntry, array);

    let displayName: string;

    if (groupbyB.length > 0) {
      const metricPart = showQueryIdentifiers
        ? `${MetricDisplayNameB} (Query B)`
        : MetricDisplayNameB;
      displayName = `${metricPart}, ${entryName}`;
    } else {
      displayName = showQueryIdentifiers ? `${entryName} (Query B)` : entryName;
    }

    const seriesFormatter = getFormatter(
      customFormattersSecondary,
      formatterSecondary,
      metricsB,
      labelMapB?.[seriesEntry]?.[0],
      !!contributionMode,
    );

    const transformedSeries = transformSeries(
      {
        ...entry,
        id: `${displayName || ''}`,
        name: `${displayName || ''}`,
      },

      colorScale,
      colorScaleKey,
      {
        area: areaB,
        markerEnabled: markerEnabledB,
        markerSize: markerSizeB,
        areaOpacity: opacityB,
        seriesType: seriesTypeB,
        showValue: showValueB,
        onlyTotal: onlyTotalB,
        stack: Boolean(stackB),
        stackIdSuffix: '\nb',
        yAxisIndex: yAxisIndexB,
        filterState,
        seriesKey: entry.name,
        sliceId,
        queryIndex: 1,
        formatter:
          seriesTypeB === EchartsTimeseriesSeriesType.Bar
            ? getOverMaxHiddenFormatter({
                max: maxSecondary,
                formatter: seriesFormatter,
              })
            : seriesFormatter,
        totalStackedValues: sortedTotalValuesB,
        showValueIndexes: showValueIndexesB,
        thresholdValues: thresholdValuesB,
        timeShiftColor,
        theme,
      },
    );

    if (transformedSeries) {
      series.push(transformedSeries);
      mapSeriesIdToAxis(transformedSeries, yAxisIndexB);
    }
  });

  if (contributionMode === 'row' && stack) {
    if (yAxisMin === undefined) yAxisMin = 0;
    if (yAxisMax === undefined) yAxisMax = 1;
    if (minSecondary === undefined) minSecondary = 0;
    if (maxSecondary === undefined) maxSecondary = 1;
  }

  const tooltipFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getTooltipTimeFormatter(tooltipTimeFormat)
      : String;
  const xAxisFormatter =
    xAxisDataType === GenericDataType.Temporal
      ? getXAxisFormatter(xAxisTimeFormat)
      : String;

  const addYAxisTitleOffset = !!(yAxisTitle || yAxisTitleSecondary);
  const addXAxisTitleOffset = !!xAxisTitle;

  const chartPadding = getPadding(
    showLegend,
    legendOrientation,
    addYAxisTitleOffset,
    zoomable,
    legendMargin,
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
        interval: xAxisLabelInterval,
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
        seriesType === EchartsTimeseriesSeriesType.Bar ||
          seriesTypeB === EchartsTimeseriesSeriesType.Bar
          ? EchartsTimeseriesSeriesType.Bar
          : undefined,
      ),
    },
    yAxis: [
      {
        ...defaultYAxis,
        type: logAxis ? 'log' : 'value',
        min: yAxisMin,
        max: yAxisMax,
        minorTick: { show: minorTicks },
        minorSplitLine: { show: minorSplitLine },
        axisLabel: {
          formatter: getYAxisFormatter(
            metrics,
            !!contributionMode,
            customFormatters,
            formatter,
            yAxisFormat,
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
        minorTick: { show: minorTicks },
        splitLine: { show: false },
        minorSplitLine: { show: minorSplitLine },
        axisLabel: {
          formatter: getYAxisFormatter(
            metricsB,
            !!contributionMode,
            customFormattersSecondary,
            formatterSecondary,
            yAxisFormatSecondary,
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

        const sortedKeys = extractTooltipKeys(
          forecastValue,
          1,
          richTooltip,
          tooltipSortByMetric,
        );

        const rows: string[][] = [];
        const forecastValues =
          extractForecastValuesFromTooltipParams(forecastValue);

        const keys = Object.keys(forecastValues);
        let focusedRow;
        sortedKeys
          .filter(key => keys.includes(key))
          .forEach(key => {
            const value = forecastValues[key];
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
            const row = formatForecastTooltipSeries({
              ...value,
              seriesName: key,
              formatter: primarySeries.has(key)
                ? tooltipFormatter
                : tooltipFormatterSecondary,
            });
            rows.push(row);
            if (key === focusedSeries) {
              focusedRow = rows.length - 1;
            }
          });
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
        chartPadding,
      ),
      // @ts-ignore
      data: series
        .filter(
          entry =>
            extractForecastSeriesContext((entry.name || '') as string).type ===
            ForecastSeriesEnum.Observation,
        )
        .map(entry => entry.id || entry.name || '')
        .concat(extractAnnotationLabels(annotationLayers))
        .sort((a: string, b: string) => {
          if (!legendSort) return 0;
          return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
        }),
    },
    series: dedupSeries(reorderForecastSeries(series) as SeriesOption[]),
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

// ============================================================================
// Render Component
// ============================================================================

function MixedRender({
  transformedProps,
}: {
  transformedProps: EchartsMixedTimeseriesChartTransformedProps;
}) {
  const {
    height,
    width,
    echartOptions,
    setDataMask,
    labelMap,
    labelMapB,
    groupby,
    groupbyB,
    selectedValues,
    formData,
    emitCrossFilters,
    seriesBreakdown,
    onContextMenu,
    onFocusedSeries,
    xValueFormatter,
    xAxis,
    refs,
    coltypeMapping,
  } = transformedProps;

  const isFirstQuery = useCallback(
    (seriesIndex: number) => seriesIndex < seriesBreakdown,
    [seriesBreakdown],
  );

  const getCrossFilterDataMask = useCallback(
    (seriesName: string, seriesIndex: number) => {
      const selected: string[] = Object.values(selectedValues || {});
      let values: string[];
      if (selected.includes(seriesName)) {
        values = selected.filter(v => v !== seriesName);
      } else {
        values = [seriesName];
      }

      const currentGroupBy = isFirstQuery(seriesIndex) ? groupby : groupbyB;
      const currentLabelMap = isFirstQuery(seriesIndex) ? labelMap : labelMapB;
      const groupbyValues = values
        .map(value => currentLabelMap?.[value])
        .filter(value => !!value);

      return {
        dataMask: {
          extraFormData: {
            // @ts-ignore
            filters:
              values.length === 0
                ? []
                : currentGroupBy.map((col, idx) => {
                    const val: DataRecordValue[] = groupbyValues.map(
                      v => v[idx],
                    );
                    if (val === null || val === undefined)
                      return {
                        col,
                        op: 'IS NULL' as const,
                      };
                    return {
                      col,
                      op: 'IN' as const,
                      val: val as (string | number | boolean)[],
                    };
                  }),
          },
          filterState: {
            value: !groupbyValues.length ? null : groupbyValues,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(seriesName),
      };
    },
    [groupby, groupbyB, isFirstQuery, labelMap, labelMapB, selectedValues],
  );

  const handleChange = useCallback(
    (seriesName: string, seriesIndex: number) => {
      const isFirst = isFirstQuery(seriesIndex);
      if (
        !emitCrossFilters ||
        (isFirst && groupby.length === 0) ||
        (!isFirst && groupbyB.length === 0)
      ) {
        return;
      }

      setDataMask(getCrossFilterDataMask(seriesName, seriesIndex).dataMask);
    },
    [
      isFirstQuery,
      emitCrossFilters,
      groupby.length,
      groupbyB.length,
      setDataMask,
      getCrossFilterDataMask,
    ],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { seriesName, seriesIndex } = props;
      handleChange(seriesName, seriesIndex);
    },
    mouseout: () => {
      onFocusedSeries(null);
    },
    mouseover: params => {
      onFocusedSeries(params.seriesName);
    },
    contextmenu: async eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, seriesName, seriesIndex } = eventParams;
        const pointerEvent = eventParams.event.event;
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        const drillByFilters: BinaryQueryObjectFilterClause[] = [];
        const isFirst = isFirstQuery(seriesIndex);
        const values = [
          ...(eventParams.name ? [eventParams.name] : []),
          ...((isFirst ? labelMap : labelMapB)[eventParams.seriesName] || []),
        ];
        if (data && xAxis.type === AxisType.Time) {
          drillToDetailFilters.push({
            col:
              xAxis.label === DTTM_ALIAS
                ? formData.granularitySqla
                : xAxis.label,
            grain: formData.timeGrainSqla,
            op: '==',
            val: data[0],
            formattedVal: xValueFormatter(data[0]),
          });
        }
        [
          ...(data && xAxis.type === AxisType.Category ? [xAxis.label] : []),
          ...(isFirst ? formData.groupby : formData.groupbyB),
        ].forEach((dimension, i) =>
          drillToDetailFilters.push({
            col: dimension,
            op: '==',
            val: values[i],
            formattedVal: String(values[i]),
          }),
        );

        [...(isFirst ? formData.groupby : formData.groupbyB)].forEach(
          (dimension, i) =>
            drillByFilters.push({
              col: dimension,
              op: '==',
              val: values[i],
              formattedVal: formatSeriesName(values[i], {
                timeFormatter: getTimeFormatter(formData.dateFormat),
                numberFormatter: getNumberFormatter(formData.numberFormat),
                coltype: coltypeMapping?.[getColumnLabel(dimension)],
              }),
            }),
        );
        const hasCrossFilter =
          (isFirst && groupby.length > 0) || (!isFirst && groupbyB.length > 0);

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: hasCrossFilter
            ? getCrossFilterDataMask(seriesName, seriesIndex)
            : undefined,
          drillBy: {
            filters: drillByFilters,
            groupbyFieldName: isFirst ? 'groupby' : 'groupby_b',
            adhocFilterFieldName: isFirst ? 'adhoc_filters' : 'adhoc_filters_b',
          },
        });
      }
    },
  };

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      selectedValues={selectedValues}
      vizType={formData.vizType}
    />
  );
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Mixed Chart'),
    description: t(
      'Visualize two different series using the same x-axis. Note that both series can be visualized with a different chart type (e.g. 1 using bars and 1 using a line).',
    ),
    category: t('Evolution'),
    tags: [
      t('Advanced-Analytics'),
      t('ECharts'),
      t('Line'),
      t('Multi-Variables'),
      t('Time'),
      t('Transformable'),
      t('Featured'),
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    supportedAnnotationTypes: [
      AnnotationType.Event,
      AnnotationType.Formula,
      AnnotationType.Interval,
      AnnotationType.Timeseries,
    ],
    // Two queries (A and B) — drives the Results tab count in the Data panel
    queryObjectCount: 2,
  },

  arguments: {},

  additionalControls: {
    query: [
      // Shared query fields
      ...([['x_axis'], ['time_grain_sqla']] as ControlSetRow[]),
      // Query A
      ...createQuerySection(t('Query A'), '').controlSetRows,
      ...createAdvancedAnalyticsSection(t('Advanced analytics Query A'), '')
        .controlSetRows,
      // Query B
      ...createQuerySection(t('Query B'), '_b').controlSetRows,
      ...createAdvancedAnalyticsSection(t('Advanced analytics Query B'), '_b')
        .controlSetRows,
      ...sections.annotationsAndLayersControls.controlSetRows,
    ],
    chartOptions: [
      ...sections.titleControls.controlSetRows,
      [
        <ControlSubSectionHeader key="chart">
          {t('Chart Options')}
        </ControlSubSectionHeader>,
      ],
      ['color_scheme'],
      ['time_shift_color'],
      ...createCustomizeSection(t('Query A'), ''),
      ...createCustomizeSection(t('Query B'), 'B'),
      ['zoomable'],
      [minorTicks],
      ...legendSection,
      [
        <ControlSubSectionHeader key="xaxis">
          {t('X Axis')}
        </ControlSubSectionHeader>,
      ],
      ['x_axis_time_format'],
      [xAxisLabelRotation],
      [xAxisLabelInterval],
      [forceMaxInterval],
      [
        <ControlSubSectionHeader key="tooltip">
          {t('Tooltip')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'show_query_identifiers',
          config: {
            type: 'CheckboxControl',
            label: t('Show query identifiers'),
            description: t(
              'Add Query A and Query B identifiers to tooltips to help differentiate series',
            ),
            default: false,
            renderTrigger: true,
          },
        },
      ],
      ...richTooltipSection.slice(1),
      [
        <ControlSubSectionHeader key="yaxis">
          {t('Y Axis')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'minorSplitLine',
          config: {
            type: 'CheckboxControl',
            label: t('Minor Split Line'),
            renderTrigger: true,
            default: minorSplitLine,
            description: t('Draw split lines for minor y-axis ticks'),
          },
        },
      ],
      [truncateXAxis],
      [xAxisBounds],
      [
        {
          name: 'truncateYAxis',
          config: {
            type: 'CheckboxControl',
            label: t('Truncate Y Axis'),
            default: truncateYAxis,
            renderTrigger: true,
            description: t(
              'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
            ),
          },
        },
      ],
      [
        {
          name: 'y_axis_bounds',
          config: {
            type: 'BoundsControl',
            label: t('Primary y-axis Bounds'),
            renderTrigger: true,
            default: yAxisBounds,
            description: t(
              'Bounds for the primary Y-axis. When left empty, the bounds are ' +
                'dynamically defined based on the min/max of the data. Note that ' +
                "this feature will only expand the axis range. It won't " +
                "narrow the data's extent.",
            ),
          },
        },
      ],
      [
        {
          name: `y_axis_format`,
          config: {
            ...sharedControls.y_axis_format,
            label: t('Primary y-axis format'),
          },
        },
      ],
      ['currency_format'],
      [
        {
          name: 'logAxis',
          config: {
            type: 'CheckboxControl',
            label: t('Logarithmic y-axis'),
            renderTrigger: true,
            default: logAxis,
            description: t('Logarithmic scale on primary y-axis'),
          },
        },
      ],
      [
        {
          name: 'y_axis_bounds_secondary',
          config: {
            type: 'BoundsControl',
            label: t('Secondary y-axis Bounds'),
            renderTrigger: true,
            default: yAxisBounds,
            description: t(
              `Bounds for the secondary Y-axis. Only works when Independent Y-axis
              bounds are enabled. When left empty, the bounds are dynamically defined
              based on the min/max of the data. Note that this feature will only expand
              the axis range. It won't narrow the data's extent.`,
            ),
          },
        },
      ],
      [
        {
          name: `y_axis_format_secondary`,
          config: {
            ...sharedControls.y_axis_format,
            label: t('Secondary y-axis format'),
          },
        },
      ],
      [
        {
          name: 'currency_format_secondary',
          config: {
            ...sharedControls.currency_format,
            label: t('Secondary currency format'),
          },
        },
      ],
      [
        {
          name: 'yAxisTitleSecondary',
          config: {
            type: 'TextControl',
            label: t('Secondary y-axis title'),
            renderTrigger: true,
            default: '',
            description: t('Logarithmic y-axis'),
          },
        },
      ],
      [
        {
          name: 'logAxisSecondary',
          config: {
            type: 'CheckboxControl',
            label: t('Logarithmic y-axis'),
            renderTrigger: true,
            default: logAxis,
            description: t('Logarithmic scale on secondary y-axis'),
          },
        },
      ],
    ],
  },

  formDataOverrides: formData => {
    const groupby = getStandardizedControls().controls.columns.filter(
      col => !ensureIsArray(formData.groupby_b).includes(col),
    );
    getStandardizedControls().controls.columns =
      getStandardizedControls().controls.columns.filter(
        col => !groupby.includes(col),
      );

    const metrics = getStandardizedControls().controls.metrics.filter(
      metric => !ensureIsArray(formData.metrics_b).includes(metric),
    );
    getStandardizedControls().controls.metrics =
      getStandardizedControls().controls.metrics.filter(
        col => !metrics.includes(col),
      );

    return {
      ...formData,
      metrics,
      groupby,
    };
  },

  buildQuery,

  transform: (chartProps: ChartProps): MixedTransformResult => {
    const transformedProps = transformMixedProps(
      chartProps as unknown as EchartsMixedTimeseriesProps,
    );
    return { transformedProps };
  },

  render: ({ transformedProps }) => (
    <MixedRender transformedProps={transformedProps} />
  ),
});
