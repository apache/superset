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
 * ECharts Histogram Chart - Glyph Pattern Implementation
 *
 * Displays the distribution of a dataset by representing the frequency
 * or count of values within different ranges or bins.
 */

import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { isEmpty } from 'lodash';
import {
  buildQueryContext,
  CategoricalColorNamespace,
  getColumnLabel,
  getValueFormatter,
  NumberFormats,
  QueryFormData,
  tooltipHtml,
} from '@superset-ui/core';
import {
  histogramOperator,
  formatSelectOptionsForRange,
  dndGroupByControl,
  columnsByType,
} from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/common';

import {
  defineChart,
  Dimension,
  Text,
  Checkbox,
  Select,
  ChartProps,
  NumberFormat,
  ShowLegend,
  ShowValue,
} from '@superset-ui/glyph-core';

import { defaultGrid, defaultYAxis } from '../defaults';
import { getLegendProps } from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';
import Echart from '../components/Echart';
import { Refs, LegendOrientation, LegendType, EventHandlers } from '../types';

import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.png';
import example1Dark from './images/example1-dark.png';
import example2 from './images/example2.png';
import example2Dark from './images/example2-dark.png';

// ============================================================================
// Constants
// ============================================================================

const BINS_OPTIONS = formatSelectOptionsForRange(5, 20, 5).map(
  ([value, label]) => ({
    label: String(label),
    value: Number(value),
  }),
);

// ============================================================================
// Types
// ============================================================================

interface HistogramTransformResult {
  transformedProps: {
    refs: Refs;
    width: number;
    height: number;
    echartOptions: EChartsCoreOption;
    formData: Record<string, unknown>;
    onFocusedSeries: (index: number | undefined) => void;
    onLegendStateChanged?: (selected: Record<string, boolean>) => void;
  };
}

// ============================================================================
// Build Query
// ============================================================================

export function buildQuery(formData: QueryFormData) {
  const { column, groupby = [], adhoc_filters } = formData;
  const hasHavingFilter = (adhoc_filters ?? []).some(
    (filter: { clause?: string }) => filter.clause === 'HAVING',
  );
  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns: [...(groupby as string[]), column as string],
      post_processing: [histogramOperator(formData, baseQueryObject)],
      metrics: hasHavingFilter
        ? [
            {
              expressionType: 'SQL' as const,
              sqlExpression: 'COUNT(*)',
              label: 'COUNT(*)',
            },
          ]
        : undefined,
    },
  ]);
}

// ============================================================================
// Chart Definition
// ============================================================================

export default defineChart({
  metadata: {
    name: t('Histogram'),
    description: t(
      `The histogram chart displays the distribution of a dataset by
      representing the frequency or count of values within different ranges or bins.
      It helps visualize patterns, clusters, and outliers in the data and provides
      insights into its shape, central tendency, and spread.`,
    ),
    category: t('Distribution'),
    tags: [t('Comparison'), t('ECharts'), t('Pattern'), t('Range')],
    credits: ['https://echarts.apache.org'],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
    ],
  },

  arguments: {
    // Query section - groupby is handled via additionalControls
    groupby: Dimension.with({
      label: t('Breakdowns'),
      description: t('Defines how the histogram data is grouped.'),
      multi: true,
    }),

    bins: Select.with({
      label: t('Bins'),
      description: t('The number of bins for the histogram'),
      options: BINS_OPTIONS,
      default: 5,
    }),

    normalize: Checkbox.with({
      label: t('Normalize'),
      description: t(`
        The normalize option transforms the histogram values into proportions or
        probabilities by dividing each bin's count by the total count of data points.
        This normalization process ensures that the resulting values sum up to 1,
        enabling a relative comparison of the data's distribution and providing a
        clearer understanding of the proportion of data points within each bin.`),
      default: false,
    }),

    cumulative: Checkbox.with({
      label: t('Cumulative'),
      description: t(`
        The cumulative option allows you to see how your data accumulates over different
        values. When enabled, the histogram bars represent the running total of frequencies
        up to each bin. This helps you understand how likely it is to encounter values
        below a certain point. Keep in mind that enabling cumulative doesn't change your
        original data, it just changes the way the histogram is displayed.`),
      default: false,
    }),

    // Chart options
    showValue: ShowValue,
    showLegend: ShowLegend,

    xAxisTitle: Text.with({
      label: t('X Axis Title'),
      description: t('Title for the X axis'),
      default: '',
    }),

    xAxisFormat: NumberFormat.with({
      label: t('X Axis Format'),
      description: t('Number format for X axis'),
    }),

    yAxisTitle: Text.with({
      label: t('Y Axis Title'),
      description: t('Title for the Y axis'),
      default: '',
    }),

    yAxisFormat: NumberFormat.with({
      label: t('Y Axis Format'),
      description: t('Number format for Y axis'),
    }),
  },

  // Column control needs special handling with mapStateToProps
  additionalControls: {
    query: [
      [
        {
          name: 'column',
          config: {
            ...dndGroupByControl,
            label: t('Column'),
            multi: false,
            description: t('Numeric column used to calculate the histogram.'),
            freeForm: false,
            disabledTabs: new Set(['saved', 'sqlExpression']),
            mapStateToProps: ({ datasource }: { datasource?: unknown }) => ({
              options: columnsByType(
                datasource as Parameters<typeof columnsByType>[0],
                GenericDataType.Numeric,
              ),
            }),
          },
        },
      ],
    ],
  },

  buildQuery,

  transform: (chartProps: ChartProps): HistogramTransformResult => {
    const {
      height,
      width,
      queriesData,
      rawFormData,
      hooks,
      theme,
      legendState = {},
      datasource,
    } = chartProps;

    const refs: Refs = {};
    let focusedSeries: number | undefined;

    const { onLegendStateChanged } = hooks;
    const { data = [] } = queriesData[0];

    // Get datasource info for formatting
    const { currencyFormats = {}, columnFormats = {} } = datasource ?? {};

    // Extract form values
    const colorScheme = rawFormData.color_scheme as string;
    const column = rawFormData.column as string;
    const groupby = (rawFormData.groupby as string[]) || [];
    const normalize = rawFormData.normalize as boolean;
    const showLegend = rawFormData.show_legend as boolean;
    const showValue = rawFormData.show_value as boolean;
    const sliceId = rawFormData.slice_id as number | undefined;
    const xAxisFormat = (rawFormData.x_axis_format as string) || 'SMART_NUMBER';
    const xAxisTitle = (rawFormData.x_axis_title as string) || '';
    const yAxisTitle = (rawFormData.y_axis_title as string) || '';
    const yAxisFormat = (rawFormData.y_axis_format as string) || 'SMART_NUMBER';

    const colorFn = CategoricalColorNamespace.getScale(colorScheme);

    const formatter = (format: string) =>
      getValueFormatter(
        column,
        currencyFormats,
        columnFormats,
        format,
        undefined,
      );
    const xAxisFormatter = formatter(xAxisFormat);
    const yAxisFormatter = formatter(yAxisFormat);

    const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);
    const groupbySet = new Set(groupby);

    // Build X axis data from histogram bin ranges
    const xAxisData: string[] = Object.keys(data[0] || {})
      .filter(key => !groupbySet.has(key))
      .map(key => {
        const array = key.split(' - ').map(value => parseFloat(value));
        return `${xAxisFormatter(array[0])} - ${xAxisFormatter(array[1])}`;
      });

    // Build bar series
    const barSeries = (data as Record<string, unknown>[]).map(datum => {
      const seriesName =
        groupby.length > 0
          ? groupby.map(key => datum[getColumnLabel(key)]).join(', ')
          : getColumnLabel(column);
      const seriesData = Object.keys(datum)
        .filter(key => !groupbySet.has(key))
        .map(key => datum[key] as number);
      return {
        name: seriesName,
        type: 'bar' as const,
        data: seriesData,
        itemStyle: {
          color: colorFn(seriesName, sliceId),
        },
        label: {
          show: showValue,
          position: 'top' as const,
          formatter: (params: { value: number | number[] }) => {
            const { value } = params;
            return yAxisFormatter.format(value as number);
          },
        },
      };
    });

    // Setup legend
    const legendOptions = barSeries.map(series => series.name as string);
    const currentLegendState = { ...legendState };
    if (isEmpty(currentLegendState)) {
      legendOptions.forEach(legend => {
        currentLegendState[legend] = true;
      });
    }

    // Tooltip formatter
    const tooltipFormatter = (params: CallbackDataParams[]) => {
      const title = params[0].name;
      const rows = params.map(param => {
        const { marker, seriesName, value } = param;
        return [
          `${marker}${seriesName}`,
          yAxisFormatter.format(value as number),
        ];
      });
      if (groupby.length > 0) {
        const total = params.reduce(
          (acc, param) => acc + (param.value as number),
          0,
        );
        if (!normalize) {
          rows.forEach((row, i) =>
            row.push(
              percentFormatter.format(
                (params[i].value as number) / (total || 1),
              ),
            ),
          );
        }
        const totalRow = ['Total', yAxisFormatter.format(total)];
        if (!normalize) {
          totalRow.push(percentFormatter.format(1));
        }
        rows.push(totalRow);
      }
      return tooltipHtml(rows, title, focusedSeries);
    };

    const onFocusedSeries = (index: number | undefined) => {
      focusedSeries = index;
    };

    const echartOptions: EChartsCoreOption = {
      grid: {
        ...defaultGrid,
        left: '5%',
        right: '5%',
        top: '10%',
        bottom: '10%',
      },
      xAxis: {
        data: xAxisData,
        name: xAxisTitle,
        nameGap: 35,
        type: 'category',
        nameLocation: 'middle',
      },
      yAxis: {
        ...defaultYAxis,
        name: yAxisTitle,
        nameGap: normalize ? 55 : 40,
        type: 'value',
        nameLocation: 'middle',
        axisLabel: {
          formatter: (value: number) => yAxisFormatter.format(value),
        },
      },
      series: barSeries,
      legend: {
        ...getLegendProps(
          LegendType.Scroll,
          LegendOrientation.Top,
          showLegend,
          theme,
          false,
          currentLegendState,
        ),
        data: legendOptions,
      },
      tooltip: {
        ...getDefaultTooltip(refs),
        trigger: 'axis',
        formatter: tooltipFormatter,
      },
    };

    return {
      transformedProps: {
        refs,
        height,
        width,
        echartOptions,
        formData: rawFormData,
        onFocusedSeries,
        onLegendStateChanged,
      },
    };
  },

  render: ({ transformedProps }) => {
    const {
      height,
      width,
      echartOptions,
      refs,
      formData,
      onFocusedSeries,
      onLegendStateChanged,
    } = transformedProps;

    const eventHandlers: EventHandlers = {
      legendselectchanged: payload => {
        onLegendStateChanged?.(payload.selected);
      },
      legendselectall: payload => {
        onLegendStateChanged?.(payload.selected);
      },
      legendinverseselect: payload => {
        onLegendStateChanged?.(payload.selected);
      },
      mouseout: () => {
        onFocusedSeries(undefined);
      },
      mouseover: params => {
        onFocusedSeries(params.seriesIndex);
      },
    };

    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
        vizType={formData.vizType as string}
      />
    );
  },
});
