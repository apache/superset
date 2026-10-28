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
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption } from 'echarts/charts';
import type { GridComponentOption } from 'echarts/components';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { isEmpty } from 'lodash-es';
import {
  CategoricalColorNamespace,
  DataRecordValue,
  NumberFormats,
  getColumnLabel,
  getValueFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { HistogramChartProps, HistogramTransformedProps } from './types';
import { LegendOrientation, LegendType, Refs } from '../types';
import { defaultGrid, defaultYAxis } from '../defaults';
import { OpacityEnum } from '../constants';
import {
  getColtypesMapping,
  getLegendProps,
  getLegendScrollDataIndex,
} from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';
import {
  HistogramBin,
  getHistogramCrossFilterKey,
  getSelectedHistogramKeys,
  parseBinKey,
} from './crossFilter';

export default function transformProps(
  chartProps: HistogramChartProps,
): HistogramTransformedProps {
  const refs: Refs = {};
  let focusedSeries: number | undefined;
  const {
    datasource: { currencyFormats = {}, columnFormats = {} },
    emitCrossFilters,
    filterState,
    formData,
    height,
    hooks,
    legendState = {},
    legendIndex,
    queriesData,
    theme,
    width,
  } = chartProps;
  const {
    onContextMenu,
    onLegendScroll,
    onLegendStateChanged,
    setDataMask = () => {},
  } = hooks;
  const {
    colorScheme,
    column,
    groupby = [],
    normalize,
    showLegend,
    showValue,
    sliceId,
    xAxisFormat,
    xAxisTitle,
    yAxisTitle,
    yAxisFormat,
  } = formData;
  const queryData = queriesData[0] ?? { data: [] };
  const data = queryData.data ?? [];
  const coltypeMapping = getColtypesMapping(queryData);
  const selectedKeys = getSelectedHistogramKeys(filterState?.selectedValues);
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
  const groupbySet = new Set(groupby.map(getColumnLabel));
  const firstRow = data[0];
  const binKeys = firstRow
    ? Object.keys(firstRow).filter(
        key => !groupbySet.has(key) && parseBinKey(key) !== undefined,
      )
    : [];
  const bins: HistogramBin[] = binKeys.map((key, index) => {
    const edges = parseBinKey(key);
    const start = edges?.start ?? Number.NaN;
    const end = edges?.end ?? Number.NaN;
    const startLabel = xAxisFormatter(start);
    const endLabel = xAxisFormatter(end);
    return {
      start,
      end,
      isLast: index === binKeys.length - 1,
      label: `${startLabel} - ${endLabel}`,
    };
  });
  const xAxisData = bins.map(bin => bin.label);
  const seriesGroupby: DataRecordValue[][] = [];
  const rows = data.map(datum => ({
    datum,
    groupbyValues: groupby.map(
      key => datum[getColumnLabel(key)] as DataRecordValue,
    ),
  }));
  // Edges are derived from the current result. A stored key from older edges
  // matches no bar, and dimming every bar would hide that the selection is stale.
  const hasMatchingSelection =
    selectedKeys.length > 0 &&
    rows.some(({ groupbyValues }) =>
      bins.some(bin =>
        selectedKeys.includes(getHistogramCrossFilterKey(bin, groupbyValues)),
      ),
    );
  const barSeries: BarSeriesOption[] = rows.map(({ datum, groupbyValues }) => {
    seriesGroupby.push(groupbyValues);
    const seriesName =
      groupby.length > 0 ? groupbyValues.join(', ') : getColumnLabel(column);
    const seriesData = bins.map((bin, index) => {
      const filterKey = getHistogramCrossFilterKey(bin, groupbyValues);
      const isDimmed = hasMatchingSelection && !selectedKeys.includes(filterKey);
      const value = datum[binKeys[index]] as number;
      return isDimmed
        ? { value, itemStyle: { opacity: OpacityEnum.SemiTransparent } }
        : { value };
    });
    return {
      name: seriesName,
      type: 'bar',
      cursor: emitCrossFilters ? 'pointer' : 'default',
      data: seriesData,
      itemStyle: {
        color: colorFn(seriesName, sliceId),
      },
      label: {
        show: showValue,
        position: 'top',
        formatter: params => {
          const { value } = params;
          return yAxisFormatter.format(value as number);
        },
      },
    };
  });

  const legendOptions = barSeries.map(series => series.name as string);
  if (isEmpty(legendState)) {
    legendOptions.forEach(legend => {
      legendState[legend] = true;
    });
  }

  const tooltipFormatter = (params: CallbackDataParams[]) => {
    const title = params[0].name;
    const rows = params.map(param => {
      const { marker, seriesName, value } = param;
      return [`${marker}${seriesName}`, yAxisFormatter.format(value as number)];
    });
    if (groupby.length > 0) {
      const total = params.reduce(
        (acc, param) => acc + (param.value as number),
        0,
      );
      if (!normalize) {
        rows.forEach((row, i) =>
          row.push(
            percentFormatter.format((params[i].value as number) / (total || 1)),
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

  const onFocusedSeries = (index?: number | undefined) => {
    focusedSeries = index;
  };

  type EChartsOption = ComposeOption<GridComponentOption | BarSeriesOption>;

  const echartOptions: EChartsOption = {
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
        legendState,
      ),
      scrollDataIndex: getLegendScrollDataIndex(
        legendIndex,
        legendOptions.length,
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
    refs,
    formData,
    width,
    height,
    echartOptions,
    onFocusedSeries,
    onLegendStateChanged,
    onLegendScroll,
    onContextMenu,
    setDataMask,
    emitCrossFilters,
    filterState,
    coltypeMapping,
    bins,
    seriesGroupby,
  };
}
