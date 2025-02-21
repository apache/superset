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
import { isEmpty } from 'lodash';
import {
  CategoricalColorNamespace,
  NumberFormats,
  getColumnLabel,
  getValueFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { HistogramChartProps, HistogramTransformedProps } from './types';
import { LegendOrientation, LegendType, Refs } from '../types';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getLegendProps } from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';

export default function transformProps(
  chartProps: HistogramChartProps,
): HistogramTransformedProps {
  const refs: Refs = {};
  let focusedSeries: number | undefined;
  const {
    datasource: { currencyFormats = {}, columnFormats = {} },
    formData,
    height,
    hooks,
    legendState = {},
    queriesData,
    theme,
    width,
  } = chartProps;
  const { onLegendStateChanged } = hooks;
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
  const { data } = queriesData[0];
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
  const xAxisData: string[] = Object.keys(data[0])
    .filter(key => !groupbySet.has(key))
    .map(key => {
      const array = key.split(' - ').map(value => parseFloat(value));
      return `${xAxisFormatter(array[0])} '-' ${xAxisFormatter(array[1])}`;
    });
  const barSeries: BarSeriesOption[] = data.map(datum => {
    const seriesName =
      groupby.length > 0
        ? groupby.map(key => datum[getColumnLabel(key)]).join(', ')
        : getColumnLabel(column);
    const seriesData = Object.keys(datum)
      .filter(key => groupbySet.has(key) === false)
      .map(key => datum[key] as number);
    return {
      name: seriesName,
      type: 'bar',
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
  };
}
