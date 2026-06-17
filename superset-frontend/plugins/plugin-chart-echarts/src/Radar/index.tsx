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
 * ECharts Radar Chart - Glyph Pattern Implementation
 *
 * Visualize a parallel set of metrics across multiple groups.
 * Each group is visualized using its own line of points and
 * each metric is represented as an edge in the chart.
 */

import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { RadarSeriesDataItemOption } from 'echarts/types/src/chart/radar/RadarSeries';
import type { RadarSeriesOption } from 'echarts/charts';
import {
  Behavior,
  buildQueryContext,
  CategoricalColorNamespace,
  DataRecord,
  ensureIsArray,
  ensureIsInt,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  isDefined,
  NumberFormatter,
  QueryFormColumn,
  QueryFormData,
  QueryFormMetric,
  SetDataMaskHook,
  ContextMenuFilters,
  validateNumber,
  ChartDataResponseResult,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  ControlFormItemSpec,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
  sharedControls,
} from '@superset-ui/chart-controls';

import {
  defineChart,
  Metric,
  Dimension,
  Select,
  Checkbox,
  ChartProps,
  createSelectedValuesMap,
} from '@superset-ui/glyph-core';
import { allEventHandlers } from '../utils/eventHandlers';

import { defaultGrid } from '../defaults';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
} from '../utils/series';
import { DEFAULT_LEGEND_FORM_DATA, OpacityEnum } from '../constants';
import { LabelPositionEnum } from '../types';

const LABEL_POSITION: [LabelPositionEnum, string][] = [
  [LabelPositionEnum.Top, t('Top')],
  [LabelPositionEnum.Left, t('Left')],
  [LabelPositionEnum.Right, t('Right')],
  [LabelPositionEnum.Bottom, t('Bottom')],
  [LabelPositionEnum.Inside, t('Inside')],
  [LabelPositionEnum.InsideLeft, t('Inside left')],
  [LabelPositionEnum.InsideRight, t('Inside right')],
  [LabelPositionEnum.InsideTop, t('Inside top')],
  [LabelPositionEnum.InsideBottom, t('Inside bottom')],
  [LabelPositionEnum.InsideTopLeft, t('Inside top left')],
  [LabelPositionEnum.InsideBottomLeft, t('Inside bottom left')],
  [LabelPositionEnum.InsideTopRight, t('Inside top right')],
  [LabelPositionEnum.InsideBottomRight, t('Inside bottom right')],
];
import { getDefaultTooltip } from '../utils/tooltip';
import { legendSection } from '../controls';
import Echart from '../components/Echart';
import { LegendOrientation, LegendType, Refs } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.jpg';
import example1Dark from './images/example1-dark.jpg';
import example2 from './images/example2.jpg';
import example2Dark from './images/example2-dark.jpg';

// ============================================================================
// Types
// ============================================================================

enum EchartsRadarLabelType {
  Value = 'value',
  KeyValue = 'key_value',
}

type RadarColumnConfig = Record<
  string,
  { radarMetricMaxValue?: number | null; radarMetricMinValue?: number }
>;

interface SeriesNormalizedMap {
  [seriesName: string]: { [normalized: string]: number };
}

const DEFAULT_FORM_DATA = {
  ...DEFAULT_LEGEND_FORM_DATA,
  groupby: [],
  labelType: EchartsRadarLabelType.Value,
  labelPosition: LabelPositionEnum.Top,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  numberFormat: 'SMART_NUMBER',
  showLabels: true,
  dateFormat: 'smart_date',
  isCircle: false,
};

interface RadarTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsCoreOption;
    formData: Record<string, unknown>;
    groupby: QueryFormColumn[];
    labelMap: Record<string, string[]>;
    setDataMask: SetDataMaskHook;
    selectedValues: Record<number, string>;
    emitCrossFilters?: boolean;
    onContextMenu?: (
      clientX: number,
      clientY: number,
      filters?: ContextMenuFilters,
    ) => void;
    coltypeMapping?: Record<string, number>;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function findGlobalMax(
  data: Record<string, unknown>[],
  metrics: string[],
): number {
  if (!data?.length || !metrics?.length) return 0;

  return data.reduce((globalMax, row) => {
    const rowMax = metrics.reduce((max, metric) => {
      const value = row[metric];
      return typeof value === 'number' &&
        Number.isFinite(value) &&
        !Number.isNaN(value)
        ? Math.max(max, value)
        : max;
    }, 0);

    return Math.max(globalMax, rowMax);
  }, 0);
}

function renderNormalizedTooltip(
  params: { color: string; name?: string; value: number[] },
  metrics: string[],
  getDenormalizedValue: (seriesName: string, value: string) => number,
  metricsWithCustomBounds: Set<string>,
): string {
  const { color, name = '', value: values } = params;
  const seriesName = name || 'series0';

  const colorDot = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:5px;height:5px;background-color:${color}"></span>`;

  const metricValues = metrics.map((metric, index) => {
    const value = values[index];
    const originalValue = metricsWithCustomBounds.has(metric)
      ? value
      : getDenormalizedValue(name, String(value));

    return { metric, value: originalValue };
  });

  const tooltipRows = metricValues
    .map(
      ({ metric, value }) => `
        <div style="display:flex;">
          <div>${colorDot}${metric}:</div>
          <div style="font-weight:bold;margin-left:auto;">${value}</div>
        </div>
      `,
    )
    .join('');

  return `
    <div style="font-weight:bold;margin-bottom:5px;">${seriesName}</div>
    ${tooltipRows}
  `;
}

function formatLabel({
  params,
  labelType,
  numberFormatter,
  getDenormalizedSeriesValue,
  metricsWithCustomBounds,
  metricLabels,
}: {
  params: CallbackDataParams;
  labelType: EchartsRadarLabelType;
  numberFormatter: NumberFormatter;
  getDenormalizedSeriesValue: (seriesName: string, value: string) => number;
  metricsWithCustomBounds: Set<string>;
  metricLabels: string[];
}): string {
  const { name = '', value, dimensionIndex = 0 } = params;
  const metricLabel = metricLabels[dimensionIndex];

  const formattedValue = numberFormatter(
    metricsWithCustomBounds.has(metricLabel)
      ? (value as number)
      : (getDenormalizedSeriesValue(name, String(value)) as number),
  );

  switch (labelType) {
    case EchartsRadarLabelType.Value:
      return formattedValue;
    case EchartsRadarLabelType.KeyValue:
      return `${name}: ${formattedValue}`;
    default:
      return name;
  }
}

// ============================================================================
// Additional Controls Configuration
// ============================================================================

const radarMetricMaxValue: { name: string; config: ControlFormItemSpec } = {
  name: 'radarMetricMaxValue',
  config: {
    controlType: 'InputNumber',
    label: t('Max'),
    description: t(
      'The maximum value of metrics. It is an optional configuration',
    ),
    width: 120,
    placeholder: t('auto'),
    debounceDelay: 400,
    validators: [validateNumber],
  },
};

const radarMetricMinValue: { name: string; config: ControlFormItemSpec } = {
  name: 'radarMetricMinValue',
  config: {
    controlType: 'InputNumber',
    label: t('Min'),
    description: t(
      'The minimum value of metrics. It is an optional configuration. If not set, it will be the minimum value of the data',
    ),
    defaultValue: '0',
    width: 120,
    placeholder: t('auto'),
    debounceDelay: 400,
    validators: [validateNumber],
  },
};

// ============================================================================
// Build Query
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const seriesLimitMetric = formData.series_limit_metric;
  const sortByMetric = ensureIsArray(seriesLimitMetric)[0];

  return buildQueryContext(formData, baseQueryObject => {
    let { metrics, orderby = [] } = baseQueryObject;
    metrics = metrics || [];
    if (sortByMetric) {
      orderby = [[sortByMetric, false]];
    } else if (metrics?.length > 0) {
      orderby = [[metrics[0], false]];
    }
    return [
      {
        ...baseQueryObject,
        orderby,
      },
    ];
  });
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Radar Chart'),
    description: t(
      'Visualize a parallel set of metrics across multiple groups. Each group is visualized using its own line of points and each metric is represented as an edge in the chart.',
    ),
    category: t('Ranking'),
    tags: [
      t('Business'),
      t('Comparison'),
      t('Multi-Variables'),
      t('Report'),
      t('Web'),
      t('ECharts'),
      t('Featured'),
    ],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
  },

  arguments: {
    groupby: Dimension.with({
      label: t('Dimensions'),
      description: t('Columns to group by'),
      multi: true,
    }),

    metrics: Metric.with({
      label: t('Metrics'),
      description: t('Metrics to display'),
      multi: true,
    }),

    showLabels: Checkbox.with({
      label: t('Show Labels'),
      description: t('Whether to display the labels.'),
      default: true,
    }),

    labelType: Select.with({
      label: t('Label Type'),
      description: t('What should be shown on the label?'),
      options: [
        { label: t('Value'), value: 'value' },
        { label: t('Category and Value'), value: 'key_value' },
      ],
      default: 'value',
    }),

    labelPosition: Select.with({
      label: t('Label position'),
      description: D3_FORMAT_DOCS,
      options: LABEL_POSITION.map(([value, label]) => ({
        value: value as string,
        label: label as string,
      })),
      default: 'top',
    }),

    numberFormat: Select.with({
      label: t('Number format'),
      description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
      options: D3_FORMAT_OPTIONS.map(([value, label]) => ({
        value: value as string,
        label: label as string,
      })),
      default: 'SMART_NUMBER',
    }),

    dateFormat: Select.with({
      label: t('Date format'),
      description: D3_FORMAT_DOCS,
      options: D3_TIME_FORMAT_OPTIONS.map(([value, label]) => ({
        value: value as string,
        label: label as string,
      })),
      default: 'smart_date',
    }),

    isCircle: Checkbox.with({
      label: t('Circle radar shape'),
      description: t("Radar render type, whether to display 'circle' shape."),
      default: false,
    }),
  },

  additionalControls: {
    query: [
      ['timeseries_limit_metric'],
      ['adhoc_filters'],
      [
        {
          name: 'row_limit',
          config: {
            ...sharedControls.row_limit,
            default: 10,
          },
        },
      ],
    ],
    chartOptions: [
      ['color_scheme'],
      ...legendSection,
      [
        {
          name: 'column_config',
          config: {
            type: 'ColumnConfigControl',
            label: t('Customize Metrics'),
            description: t('Further customize how to display each metric'),
            renderTrigger: true,
            configFormLayout: {
              [GenericDataType.Numeric]: [
                [radarMetricMinValue, radarMetricMaxValue],
              ],
            },
            shouldMapStateToProps() {
              return true;
            },
            mapStateToProps(
              explore: {
                controls?: { metrics?: { value?: QueryFormMetric[] } };
              },
              _: unknown,
              chart: { queriesResponse?: ChartDataResponseResult[] },
            ) {
              const values = explore?.controls?.metrics?.value ?? [];
              const metricColumn = values.map(value => {
                if (typeof value === 'string') {
                  return value;
                }
                return value.label;
              });
              const { colnames: _colnames, coltypes: _coltypes } =
                chart?.queriesResponse?.[0] ?? {};
              const colnames: string[] = _colnames || [];
              const coltypes: GenericDataType[] = _coltypes || [];

              return {
                queryResponse: chart?.queriesResponse?.[0] as
                  | ChartDataResponseResult
                  | undefined,
                appliedColumnNames: metricColumn,
                columnsPropsObject: { colnames, coltypes },
              };
            },
          },
        },
      ],
    ],
  },

  formDataOverrides: (formData: QueryFormData) => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
    groupby: getStandardizedControls().popAllColumns(),
  }),

  buildQuery,

  transform: (chartProps: ChartProps): RadarTransformResult => {
    const {
      width,
      height,
      rawFormData,
      hooks,
      filterState,
      queriesData,
      theme,
      inContextMenu,
      emitCrossFilters,
    } = chartProps;

    const refs: Refs = {};
    const { data = [] } = queriesData[0];
    const globalMax = findGlobalMax(
      data as Record<string, unknown>[],
      Object.keys(data[0] || {}),
    );
    const coltypeMapping = getColtypesMapping(
      queriesData[0] as unknown as Parameters<typeof getColtypesMapping>[0],
    );
    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};

    // Extract form values with defaults
    const colorScheme = rawFormData.color_scheme as string;
    const groupby = (rawFormData.groupby as QueryFormColumn[]) || [];
    const metrics = (rawFormData.metrics as QueryFormMetric[]) || [];
    const labelType =
      (rawFormData.label_type as EchartsRadarLabelType) ||
      DEFAULT_FORM_DATA.labelType;
    const labelPosition =
      (rawFormData.label_position as LabelPositionEnum) ||
      DEFAULT_FORM_DATA.labelPosition;
    const legendOrientation =
      (rawFormData.legend_orientation as LegendOrientation) ||
      DEFAULT_FORM_DATA.legendOrientation;
    const legendType =
      (rawFormData.legend_type as LegendType) || DEFAULT_FORM_DATA.legendType;
    const legendMargin = rawFormData.legend_margin as number | undefined;
    const numberFormat =
      (rawFormData.number_format as string) || DEFAULT_FORM_DATA.numberFormat;
    const dateFormat =
      (rawFormData.date_format as string) || DEFAULT_FORM_DATA.dateFormat;
    const showLabels =
      rawFormData.show_labels !== undefined
        ? (rawFormData.show_labels as boolean)
        : DEFAULT_FORM_DATA.showLabels;
    const showLegend =
      rawFormData.show_legend !== undefined
        ? (rawFormData.show_legend as boolean)
        : DEFAULT_FORM_DATA.showLegend;
    const legendSort = rawFormData.legend_sort as string | undefined;
    const isCircle =
      rawFormData.is_circle !== undefined
        ? (rawFormData.is_circle as boolean)
        : DEFAULT_FORM_DATA.isCircle;
    const columnConfig = rawFormData.column_config as
      | RadarColumnConfig
      | undefined;
    const sliceId = rawFormData.slice_id as number | undefined;

    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
    const numberFormatter = getNumberFormatter(numberFormat);
    const denormalizedSeriesValues: SeriesNormalizedMap = {};

    const getDenormalizedSeriesValue = (
      seriesName: string,
      normalizedValue: string,
    ): number =>
      denormalizedSeriesValues?.[seriesName]?.[normalizedValue] ??
      Number(normalizedValue);

    const metricLabels = metrics.map(getMetricLabel);

    const metricsWithCustomBounds = new Set(
      metricLabels.filter(metricLabel => {
        const config = columnConfig?.[metricLabel];
        const hasMax = !!isDefined(config?.radarMetricMaxValue);
        const hasMin =
          isDefined(config?.radarMetricMinValue) &&
          config?.radarMetricMinValue !== 0;
        return hasMax || hasMin;
      }),
    );

    const formatter = (params: CallbackDataParams) =>
      formatLabel({
        params,
        numberFormatter,
        labelType,
        getDenormalizedSeriesValue,
        metricsWithCustomBounds,
        metricLabels,
      });

    const groupbyLabels = groupby.map(getColumnLabel);

    const metricLabelAndMaxValueMap = new Map<string, number>();
    const metricLabelAndMinValueMap = new Map<string, number>();
    const columnsLabelMap = new Map<string, string[]>();
    const transformedData: RadarSeriesDataItemOption[] = [];

    (data as Record<string, unknown>[]).forEach(datum => {
      const joinedName = extractGroupbyLabel({
        datum: datum as DataRecord,
        groupby: groupbyLabels,
        coltypeMapping,
        timeFormatter: getTimeFormatter(dateFormat),
      });

      columnsLabelMap.set(
        joinedName,
        groupbyLabels.map(col => datum[col] as string),
      );

      for (const [metricLabel, value] of Object.entries(datum)) {
        if (metricLabelAndMaxValueMap.has(metricLabel)) {
          metricLabelAndMaxValueMap.set(
            metricLabel,
            Math.max(
              value as number,
              ensureIsInt(
                metricLabelAndMaxValueMap.get(metricLabel),
                Number.MIN_SAFE_INTEGER,
              ),
            ),
          );
        } else {
          metricLabelAndMaxValueMap.set(metricLabel, value as number);
        }

        if (metricLabelAndMinValueMap.has(metricLabel)) {
          metricLabelAndMinValueMap.set(
            metricLabel,
            Math.min(
              value as number,
              ensureIsInt(
                metricLabelAndMinValueMap.get(metricLabel),
                Number.MAX_SAFE_INTEGER,
              ),
            ),
          );
        } else {
          metricLabelAndMinValueMap.set(metricLabel, value as number);
        }
      }

      const isFiltered =
        filterState?.selectedValues &&
        !filterState.selectedValues.includes(joinedName);

      transformedData.push({
        value: metricLabels.map(metricLabel => datum[metricLabel]),
        name: joinedName,
        itemStyle: {
          color: colorFn(joinedName, sliceId),
          opacity: isFiltered
            ? OpacityEnum.Transparent
            : OpacityEnum.NonTransparent,
        },
        lineStyle: {
          opacity: isFiltered
            ? OpacityEnum.SemiTransparent
            : OpacityEnum.NonTransparent,
        },
        label: {
          show: showLabels,
          position: labelPosition,
          formatter,
        },
      } as RadarSeriesDataItemOption);
    });

    const seriesNames = transformedData.map(d => d.name as string);
    const selectedValues = createSelectedValuesMap(filterState, seriesNames);

    const normalizeArray = (arr: number[], decimals = 10, seriesName: string) =>
      arr.map((value, index) => {
        const metricLabel = metricLabels[index];
        if (metricsWithCustomBounds.has(metricLabel)) {
          return value;
        }

        const max = Math.max(...arr);
        const normalizedValue = Number((value / max).toFixed(decimals));

        denormalizedSeriesValues[seriesName][String(normalizedValue)] = value;
        return normalizedValue;
      });

    const normalizedTransformedData = transformedData.map(series => {
      if (Array.isArray(series.value)) {
        const seriesName = String(series?.name || '');
        denormalizedSeriesValues[seriesName] = {};

        return {
          ...series,
          value: normalizeArray(series.value as number[], 10, seriesName),
        };
      }
      return series;
    });

    const indicator = metricLabels.map(metricLabel => {
      const isMetricWithCustomBounds = metricsWithCustomBounds.has(metricLabel);
      if (!isMetricWithCustomBounds) {
        return {
          name: metricLabel,
          max: 1,
          min: 0,
        };
      }
      const maxValueInControl =
        columnConfig?.[metricLabel]?.radarMetricMaxValue;
      const minValueInControl =
        columnConfig?.[metricLabel]?.radarMetricMinValue;

      const maxValue =
        metricLabelAndMaxValueMap.get(metricLabel) === 0
          ? Number.MAX_SAFE_INTEGER
          : globalMax;
      const max = isDefined(maxValueInControl) ? maxValueInControl : maxValue;

      let min: number;
      if (isDefined(minValueInControl)) {
        min = minValueInControl;
      } else {
        min = 0;
      }

      return {
        name: metricLabel,
        max,
        min,
      };
    });

    const series: RadarSeriesOption[] = [
      {
        type: 'radar',
        ...getChartPadding(showLegend, legendOrientation, legendMargin),
        animation: false,
        emphasis: {
          label: {
            show: true,
            fontWeight: 'bold',
          },
        },
        data: normalizedTransformedData,
      },
    ];

    const normalizedTooltipFormatter = (
      params: CallbackDataParams & {
        color: string;
        name: string;
        value: number[];
      },
    ) =>
      renderNormalizedTooltip(
        params,
        metricLabels,
        getDenormalizedSeriesValue,
        metricsWithCustomBounds,
      );

    const echartOptions: EChartsCoreOption = {
      grid: {
        ...defaultGrid,
      },
      tooltip: {
        ...getDefaultTooltip(refs),
        show: !inContextMenu,
        trigger: 'item',
        formatter: normalizedTooltipFormatter,
      },
      legend: {
        ...getLegendProps(legendType, legendOrientation, showLegend, theme),
        data: Array.from(columnsLabelMap.keys()).sort(
          (a: string, b: string) => {
            if (!legendSort) return 0;
            return legendSort === 'asc'
              ? a.localeCompare(b)
              : b.localeCompare(a);
          },
        ),
      },
      series,
      radar: {
        shape: isCircle ? 'circle' : 'polygon',
        indicator,
        splitLine: {
          show: true,
          lineStyle: {
            color: theme.colorSplit,
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: [theme.colorBgLayout, theme.colorBgContainer],
          },
        },
        axisLine: {
          lineStyle: {
            color: theme.colorSplit,
          },
        },
      },
    };

    return {
      transformedProps: {
        refs,
        width,
        height,
        echartOptions,
        formData: rawFormData,
        groupby,
        labelMap: Object.fromEntries(columnsLabelMap),
        setDataMask,
        selectedValues,
        emitCrossFilters,
        onContextMenu,
        coltypeMapping,
      },
    };
  },

  render: ({ transformedProps }) => {
    const { height, width, echartOptions, selectedValues, refs, formData } =
      transformedProps;

    const eventHandlers = allEventHandlers(transformedProps);

    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
        selectedValues={selectedValues}
        vizType={formData.vizType as string}
      />
    );
  },
});
