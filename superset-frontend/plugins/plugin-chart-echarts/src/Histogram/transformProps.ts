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
import { BarSeriesOption, EChartsOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { isEmpty } from 'lodash';
import {
  CategoricalColorNamespace,
  NumberFormats,
  getColumnLabel,
  getNumberFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { HistogramChartProps, HistogramTransformedProps } from './types';
import { LegendOrientation, LegendType, Refs } from '../types';
import { defaultGrid, defaultYAxis } from '../defaults';
import { getLegendProps } from '../utils/series';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPercentFormatter } from '../utils/formatters';

const TOTAL_SERIES = 'total';

export default function transformProps(
  chartProps: HistogramChartProps,
): HistogramTransformedProps {
  const refs: Refs = {};
  let focusedSeries: number | undefined;
  const {
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
    xAxisTitle,
    yAxisTitle,
  } = formData;
  const { data } = queriesData[0];
  const colorFn = CategoricalColorNamespace.getScale(colorScheme);
  const formatter = getNumberFormatter(
    normalize ? NumberFormats.FLOAT_3_POINT : NumberFormats.INTEGER,
  );
  const percentFormatter = getPercentFormatter(NumberFormats.PERCENT_2_POINT);
  const groupbySet = new Set(groupby);
  const xAxisData: string[] = Object.keys(data[0]).filter(
    key => groupbySet.has(key) === false,
  );
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
      stack: 'stack',
      itemStyle: {
        color: colorFn(seriesName, sliceId),
      },
    };
  });

  const legendOptions = barSeries.map(series => series.name as string);
  if (isEmpty(legendState)) {
    legendOptions.forEach(legend => {
      legendState[legend] = true;
    });
  }

  if (showValue) {
    barSeries.push({
      name: TOTAL_SERIES,
      type: 'bar',
      stack: 'stack',
      silent: true,
      label: {
        show: true,
        position: 'top',
        formatter: params => {
          const { dataIndex } = params;
          return formatter.format(
            barSeries
              .filter(series => legendState[series.name!])
              .reduce(
                (acc, series) => acc + (series.data![dataIndex] as number),
                0,
              ),
          );
        },
      },
      data: barSeries[0].data!.map(() => 0),
    });
  }

  const tooltipFormatter = (params: CallbackDataParams[]) => {
    const title = params[0].name;
    const array = params.filter(param => param.seriesName !== TOTAL_SERIES);
    const rows = array.map(param => {
      const { marker, seriesName, value } = param;
      return [`${marker}${seriesName}`, formatter.format(value as number)];
    });
    if (groupby.length > 0) {
      const total = array.reduce(
        (acc, param) => acc + (param.value as number),
        0,
      );
      rows.forEach((row, i) =>
        row.push(
          percentFormatter.format((params[i].value as number) / (total || 1)),
        ),
      );
      rows.push(['Total', formatter.format(total), percentFormatter.format(1)]);
    }
    return tooltipHtml(rows, title, focusedSeries);
  };

  const onFocusedSeries = (index?: number | undefined) => {
    focusedSeries = index;
  };

  const echartOptions: EChartsOption = {
    grid: {
      ...defaultGrid,
      bottom: 30,
      left: 30,
      right: 30,
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
        formatter: (value: number) => formatter.format(value),
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
