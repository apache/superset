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
 * ECharts Box Plot Chart - Glyph Pattern Implementation
 *
 * Also known as a box and whisker plot, this visualization compares the
 * distributions of a related metric across multiple groups.
 */

import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { BoxplotSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  AdhocColumn,
  Behavior,
  buildQueryContext,
  CategoricalColorNamespace,
  DataRecord,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  isAdhocColumn,
  isPhysicalColumn,
  QueryFormData,
  QueryFormColumn,
  SetDataMaskHook,
  ContextMenuFilters,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  boxplotOperator,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  sections,
  sharedControls,
  getStandardizedControls,
  ControlState,
  ControlPanelState,
  getTemporalColumns,
} from '@superset-ui/chart-controls';

import {
  defineChart,
  Metric,
  Dimension,
  Text,
  Select,
  Checkbox,
  ChartProps,
  NumberFormat,
  TimeFormat,
  createSelectedValuesMap,
} from '@superset-ui/glyph-core';
import { allEventHandlers } from '../utils/eventHandlers';

import { defaultGrid, defaultYAxis } from '../defaults';
import {
  extractGroupbyLabel,
  getColtypesMapping,
  sanitizeHtml,
} from '../utils/series';
import { convertInteger } from '../utils/convertInteger';
import { getPadding } from '../Timeseries/transformers';
import { OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import Echart from '../components/Echart';
import { Refs, LegendOrientation } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/BoxPlot.jpg';
import exampleDark from './images/BoxPlot-dark.jpg';

// ============================================================================
// Constants
// ============================================================================

const WHISKER_OPTIONS = [
  { label: t('Tukey'), value: 'Tukey' },
  { label: t('Min/max (no outliers)'), value: 'Min/max (no outliers)' },
  { label: t('2/98 percentiles'), value: '2/98 percentiles' },
  { label: t('5/95 percentiles'), value: '5/95 percentiles' },
  { label: t('9/91 percentiles'), value: '9/91 percentiles' },
  { label: t('10/90 percentiles'), value: '10/90 percentiles' },
];

const X_TICK_LAYOUT_OPTIONS = [
  { label: t('auto'), value: 'auto' },
  { label: t('flat'), value: 'flat' },
  { label: '45°', value: '45°' },
  { label: '90°', value: '90°' },
  { label: t('staggered'), value: 'staggered' },
];

// ============================================================================
// Types
// ============================================================================

interface BoxPlotTransformResult {
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
// Build Query
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: [
        ...(ensureIsArray(formData.columns).length === 0 &&
        formData.granularity_sqla
          ? [formData.granularity_sqla]
          : ensureIsArray(formData.columns)
        ).map(col => {
          if (
            isPhysicalColumn(col) &&
            formData.time_grain_sqla &&
            formData?.temporal_columns_lookup?.[col]
          ) {
            return {
              timeGrain: formData.time_grain_sqla,
              columnType: 'BASE_AXIS',
              sqlExpression: col,
              label: col,
              expressionType: 'SQL',
            } as AdhocColumn;
          }
          return col;
        }),
        ...ensureIsArray(formData.groupby),
      ],
      series_columns: formData.groupby,
      post_processing: [boxplotOperator(formData, baseQueryObject)],
    },
  ]);
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Box Plot'),
    description: t(
      'Also known as a box and whisker plot, this visualization compares the distributions of a related metric across multiple groups. The box in the middle emphasizes the mean, median, and inner 2 quartiles. The whiskers around each box visualize the min, max, range, and outer 2 quartiles.',
    ),
    category: t('Distribution'),
    tags: [t('ECharts'), t('Range'), t('Statistical'), t('Featured')],
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },

  arguments: {
    // Query section
    groupby: Dimension.with({
      label: t('Dimensions'),
      description: t('Categories to group by on the x-axis.'),
      multi: true,
    }),

    metrics: Metric.with({
      label: t('Metrics'),
      description: t('Metrics to display'),
      multi: true,
    }),

    whiskerOptions: Select.with({
      label: t('Whisker/outlier options'),
      description: t('Determines how whiskers and outliers are calculated.'),
      options: WHISKER_OPTIONS,
      default: 'Tukey',
    }),

    // Chart options
    xTicksLayout: Select.with({
      label: t('X Tick Layout'),
      description: t('The way the ticks are laid out on the X-axis'),
      options: X_TICK_LAYOUT_OPTIONS,
      default: 'auto',
    }),

    numberFormat: NumberFormat.with({
      label: t('Number format'),
      description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
    }),

    dateFormat: TimeFormat.with({
      label: t('Date format'),
      description: D3_FORMAT_DOCS,
    }),

    zoomable: Checkbox.with({
      label: t('Data Zoom'),
      description: t('Enable data zooming controls'),
      default: false,
    }),

    // Title controls
    xAxisTitle: Text.with({
      label: t('X Axis Title'),
      description: t('Title for the X axis'),
      default: '',
    }),

    yAxisTitle: Text.with({
      label: t('Y Axis Title'),
      description: t('Title for the Y axis'),
      default: '',
    }),
  },

  // Complex controls that need mapStateToProps or visibility logic
  additionalControls: {
    query: [
      ['columns'],
      [
        {
          name: 'time_grain_sqla',
          config: {
            ...sharedControls.time_grain_sqla,
            visibility: ({
              controls,
            }: {
              controls: Record<string, unknown>;
            }) => {
              const dttmLookup = Object.fromEntries(
                ensureIsArray(
                  (
                    controls?.columns as {
                      options?: { column_name: string; is_dttm: boolean }[];
                    }
                  )?.options,
                ).map(option => [option.column_name, option.is_dttm]),
              );

              return ensureIsArray(
                (controls?.columns as { value?: unknown })?.value,
              )
                .map(selection => {
                  if (isAdhocColumn(selection)) {
                    return true;
                  }
                  if (isPhysicalColumn(selection)) {
                    return !!dttmLookup[selection];
                  }
                  return false;
                })
                .some(Boolean);
            },
          },
        },
        'temporal_columns_lookup',
      ],
      ['adhoc_filters'],
      ['series_limit'],
      ['series_limit_metric'],
      ['row_limit'],
    ],
    chartOptions: [...sections.titleControls.controlSetRows],
  },

  additionalControlOverrides: {
    columns: {
      label: t('Distribute across'),
      multi: true,
      description: t('Columns to calculate distribution across.'),
      initialValue: (
        control: ControlState,
        state: ControlPanelState | null,
      ) => {
        if (
          state &&
          (!control?.value ||
            (Array.isArray(control?.value) && control.value.length === 0))
        ) {
          return [getTemporalColumns(state.datasource).defaultTemporalColumn];
        }
        return control.value;
      },
      validators: [validateNonEmpty],
    },
  },

  formDataOverrides: (formData: QueryFormData) => {
    const groupby = getStandardizedControls().controls.columns.filter(
      col => !ensureIsArray(formData.columns).includes(col),
    );
    getStandardizedControls().controls.columns =
      getStandardizedControls().controls.columns.filter(
        col => !groupby.includes(col),
      );

    return {
      ...formData,
      metrics: getStandardizedControls().popAllMetrics(),
      groupby,
    };
  },

  buildQuery,

  transform: (chartProps: ChartProps): BoxPlotTransformResult => {
    const {
      width,
      height,
      rawFormData,
      hooks,
      filterState,
      queriesData,
      inContextMenu,
      emitCrossFilters,
    } = chartProps;

    const { data = [] } = queriesData[0];
    const { setDataMask = () => {}, onContextMenu } = hooks ?? {};
    const coltypeMapping = getColtypesMapping(
      queriesData[0] as unknown as Parameters<typeof getColtypesMapping>[0],
    );
    const refs: Refs = {};

    // Extract form values
    const colorScheme = rawFormData.color_scheme as string;
    const groupby = (rawFormData.groupby as QueryFormColumn[]) || [];
    const metrics = (rawFormData.metrics as string[]) || [];
    const numberFormat =
      (rawFormData.number_format as string) || 'SMART_NUMBER';
    const dateFormat = (rawFormData.date_format as string) || 'smart_date';
    const xTicksLayout = (rawFormData.x_ticks_layout as string) || 'auto';
    const legendOrientation =
      (rawFormData.legend_orientation as LegendOrientation) || 'top';
    const xAxisTitle = (rawFormData.x_axis_title as string) || '';
    const yAxisTitle = (rawFormData.y_axis_title as string) || '';
    const xAxisTitleMargin = rawFormData.x_axis_title_margin as number;
    const yAxisTitleMargin = rawFormData.y_axis_title_margin as number;
    const yAxisTitlePosition =
      (rawFormData.y_axis_title_position as string) || 'Left';
    const sliceId = rawFormData.slice_id as number | undefined;
    const zoomable = rawFormData.zoomable as boolean;

    const colorFn = CategoricalColorNamespace.getScale(colorScheme);
    const numberFormatter = getNumberFormatter(numberFormat);
    const metricLabels = metrics.map(getMetricLabel);
    const groupbyLabels = groupby.map(getColumnLabel);

    const transformedData = (data as Record<string, unknown>[])
      .map(datum => {
        const groupbyLabel = extractGroupbyLabel({
          datum: datum as DataRecord,
          groupby: groupbyLabels,
          coltypeMapping,
          timeFormatter: getTimeFormatter(dateFormat),
        });
        return metricLabels.map(metric => {
          const name =
            metricLabels.length === 1
              ? groupbyLabel
              : `${groupbyLabel}, ${metric}`;
          const isFiltered =
            filterState?.selectedValues &&
            !filterState.selectedValues.includes(name);
          return {
            name,
            value: [
              datum[`${metric}__min`],
              datum[`${metric}__q1`],
              datum[`${metric}__median`],
              datum[`${metric}__q3`],
              datum[`${metric}__max`],
              datum[`${metric}__mean`],
              datum[`${metric}__count`],
              datum[`${metric}__outliers`],
            ],
            itemStyle: {
              color: colorFn(groupbyLabel, sliceId),
              opacity: isFiltered ? OpacityEnum.SemiTransparent : 0.6,
              borderColor: colorFn(groupbyLabel, sliceId),
            },
          };
        });
      })
      .flatMap(row => row);

    const outlierData = (data as Record<string, unknown>[])
      .map(datum =>
        metricLabels.map(metric => {
          const groupbyLabel = extractGroupbyLabel({
            datum: datum as DataRecord,
            groupby: groupbyLabels,
            coltypeMapping,
            timeFormatter: getTimeFormatter(dateFormat),
          });
          const name =
            metricLabels.length === 1
              ? groupbyLabel
              : `${groupbyLabel}, ${metric}`;
          const outlierDatum = (datum[`${metric}__outliers`] || []) as number[];
          const isFiltered =
            filterState?.selectedValues &&
            !filterState.selectedValues.includes(name);
          return {
            name: 'outlier',
            type: 'scatter',
            data: outlierDatum.map(val => [name, val]),
            tooltip: {
              ...getDefaultTooltip(refs),
              formatter: (param: { data: [string, number] }) => {
                const [outlierName, stats] = param.data;
                const headline = groupbyLabels.length
                  ? `<p><strong>${sanitizeHtml(outlierName)}</strong></p>`
                  : '';
                return `${headline}${numberFormatter(stats)}`;
              },
            },
            itemStyle: {
              color: colorFn(groupbyLabel, sliceId),
              opacity: isFiltered
                ? OpacityEnum.SemiTransparent
                : OpacityEnum.NonTransparent,
            },
          };
        }),
      )
      .flat(2);

    const labelMap: Record<string, string[]> = (
      data as Record<string, unknown>[]
    ).reduce(
      (acc: Record<string, string[]>, datum) => {
        const label = extractGroupbyLabel({
          datum: datum as DataRecord,
          groupby: groupbyLabels,
          coltypeMapping,
          timeFormatter: getTimeFormatter(dateFormat),
        });
        return {
          ...acc,
          [label]: groupbyLabels.map(col => datum[col] as string),
        };
      },
      {} as Record<string, string[]>,
    ) as Record<string, string[]>;

    const seriesNames = transformedData.map(d => d.name);
    const selectedValues = createSelectedValuesMap(filterState, seriesNames);

    let axisLabel;
    if (xTicksLayout === '45°') axisLabel = { rotate: -45 };
    else if (xTicksLayout === '90°') axisLabel = { rotate: -90 };
    else if (xTicksLayout === 'flat') axisLabel = { rotate: 0 };
    else if (xTicksLayout === 'staggered') axisLabel = { rotate: -45 };
    else axisLabel = { show: true };

    const series: BoxplotSeriesOption[] = [
      {
        name: 'boxplot',
        type: 'boxplot',
        data: transformedData as BoxplotSeriesOption['data'],
        tooltip: {
          ...getDefaultTooltip(refs),
          formatter: (param: CallbackDataParams) => {
            const { value, name } = param as unknown as {
              value: [
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number,
                number[],
              ];
              name: string;
            };
            const headline = name
              ? `<p><strong>${sanitizeHtml(name)}</strong></p>`
              : '';
            const stats = [
              `Max: ${numberFormatter(value[5])}`,
              `3rd Quartile: ${numberFormatter(value[4])}`,
              `Mean: ${numberFormatter(value[6])}`,
              `Median: ${numberFormatter(value[3])}`,
              `1st Quartile: ${numberFormatter(value[2])}`,
              `Min: ${numberFormatter(value[1])}`,
              `# Observations: ${value[7]}`,
            ];
            if (value[8].length > 0) {
              stats.push(`# Outliers: ${value[8].length}`);
            }
            return headline + stats.join('<br/>');
          },
        },
      },
      // @ts-ignore - outlier scatter series
      ...outlierData,
    ];

    const addYAxisTitleOffset = !!yAxisTitle;
    const addXAxisTitleOffset = !!xAxisTitle;
    const chartPadding = getPadding(
      true,
      legendOrientation,
      addYAxisTitleOffset,
      false,
      null,
      addXAxisTitleOffset,
      yAxisTitlePosition,
      convertInteger(yAxisTitleMargin),
      convertInteger(xAxisTitleMargin),
    );

    const echartOptions: EChartsCoreOption = {
      grid: {
        ...defaultGrid,
        ...chartPadding,
      },
      xAxis: {
        type: 'category',
        data: transformedData.map(row => row.name),
        axisLabel,
        name: xAxisTitle,
        nameGap: convertInteger(xAxisTitleMargin),
        nameLocation: 'middle',
      },
      yAxis: {
        ...defaultYAxis,
        type: 'value',
        axisLabel: { formatter: numberFormatter },
        name: yAxisTitle,
        nameGap: convertInteger(yAxisTitleMargin),
        nameLocation: yAxisTitlePosition === 'Left' ? 'middle' : 'end',
      },
      tooltip: {
        ...getDefaultTooltip(refs),
        show: !inContextMenu,
        trigger: 'item',
        axisPointer: {
          type: 'shadow',
        },
      },
      series,
      toolbox: {
        show: zoomable,
        feature: {
          dataZoom: {
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
              type: 'inside',
              zoomOnMouseWheel: false,
              moveOnMouseWheel: true,
            },
          ]
        : [],
    };

    return {
      transformedProps: {
        refs,
        width,
        height,
        echartOptions,
        formData: rawFormData,
        groupby,
        labelMap,
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
