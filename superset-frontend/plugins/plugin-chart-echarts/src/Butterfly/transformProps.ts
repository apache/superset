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
import {
  CurrencyFormatter,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  NumberFormatter,
  rgbToHex,
  tooltipHtml,
} from '@superset-ui/core';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption } from 'echarts/charts';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { EchartsButterflyChartProps, ButterflyTransformedProps } from './types';
import { DEFAULT_FORM_DATA } from './constants';
import { defaultGrid } from '../defaults';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { OpacityEnum } from '../constants';
import {
  getChartPadding,
  getLegendProps,
  getColtypesMapping,
  extractGroupbyLabel,
} from '../utils/series';
import { resolveLegendLayout } from '../utils/legendLayout';
import { convertInteger } from '../utils/convertInteger';

type EChartsOption = ComposeOption<BarSeriesOption>;

const LABEL_LEFT = { position: 'left' as const };
const LABEL_RIGHT = { position: 'right' as const };

function formatTooltip(
  params: CallbackDataParams[],
  formatter: NumberFormatter | CurrencyFormatter,
  categoryLabels: string[],
  categoryByKey: Map<string, string>,
) {
  const axisParams = params.filter(
    param => param.seriesName && typeof param.value === 'number',
  );
  if (!axisParams.length) {
    return '';
  }

  const { dataIndex, name } = axisParams[0];
  const title =
    (typeof dataIndex === 'number'
      ? categoryLabels.at(dataIndex)
      : undefined) ??
    (typeof name === 'string' ? categoryByKey.get(name) : undefined) ??
    name;
  const rows = axisParams.map(param => [
    param.seriesName!,
    formatter(Math.abs(param.value as number)),
  ]);

  return tooltipHtml(rows, title);
}

export default function transformProps(
  chartProps: EchartsButterflyChartProps,
): ButterflyTransformedProps {
  const {
    width,
    height,
    formData,
    legendState,
    queriesData,
    hooks,
    theme,
    inContextMenu,
    filterState,
    emitCrossFilters,
  } = chartProps;
  const refs: Refs = {};
  const { data = [] } = queriesData[0];
  const { setDataMask = () => {}, onContextMenu, onLegendStateChanged } = hooks;

  const {
    currencyFormat,
    groupby,
    leftMetric,
    rightMetric,
    leftColor = { r: 84, g: 112, b: 198, a: 1 },
    rightColor = { r: 145, g: 204, b: 117, a: 1 },
    leftLabel,
    rightLabel,
    xAxisLabel,
    yAxisLabel,
    xAxisFormat,
    xAxisTitleMargin,
    yAxisTitleMargin,
    showLegend,
    legendMargin,
    legendOrientation,
    legendType,
    legendSort,
    showValue,
    xAxisLabelRotation,
  }: EchartsButterflyChartProps['formData'] = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };

  const leftMetricLabel = leftMetric ? getMetricLabel(leftMetric) : '';
  const rightMetricLabel = rightMetric ? getMetricLabel(rightMetric) : '';
  const leftSeriesName = leftLabel || leftMetricLabel;
  const rightSeriesName = rightLabel || rightMetricLabel;

  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const groupbyColumns = ensureIsArray(groupby);
  const groupbyLabels = groupbyColumns.map(getColumnLabel);

  const defaultFormatter = currencyFormat?.symbol
    ? new CurrencyFormatter({ d3Format: xAxisFormat, currency: currencyFormat })
    : getNumberFormatter(xAxisFormat);

  const categories = data.map(datum =>
    extractGroupbyLabel({ datum, groupby: groupbyLabels, coltypeMapping }),
  );
  const categoryKeys = data.map((datum, index) => {
    const label = categories.at(index) ?? '';
    return `${label}__${JSON.stringify(
      groupbyLabels.map(col =>
        Object.hasOwn(datum, col) ? datum[col] : undefined,
      ),
    )}`;
  });
  const categoryByKey = new Map(
    categoryKeys.flatMap((key, index) => {
      const label = categories.at(index);
      return label === undefined ? [] : [[key, label] as const];
    }),
  );

  const labelMap = data.reduce<Record<string, string[]>>(
    (acc, datum, index) => {
      const uniqueKey = categoryKeys.at(index);
      if (uniqueKey === undefined) {
        return acc;
      }
      acc[uniqueKey] = groupbyLabels.map(col =>
        Object.hasOwn(datum, col) ? (datum[col] as string) : '',
      );
      return acc;
    },
    {},
  );
  const selectedValues = (filterState.selectedValues || []).reduce(
    (acc: Record<number, string>, value: string) => {
      const index = categoryKeys.indexOf(value);
      return index >= 0 ? { ...acc, [index]: value } : acc;
    },
    {},
  );
  const getOpacity = (categoryKey: string) =>
    filterState.selectedValues?.length &&
    !filterState.selectedValues.includes(categoryKey)
      ? OpacityEnum.SemiTransparent
      : OpacityEnum.NonTransparent;

  const leftData = data.map((row, i) => ({
    name: categoryKeys[i],
    value: -Math.abs(Number(row[leftMetricLabel] ?? 0)),
    label: LABEL_LEFT,
    itemStyle: { opacity: getOpacity(categoryKeys[i]) },
  }));
  const rightData = data.map((row, i) => ({
    name: categoryKeys[i],
    value: Math.abs(Number(row[rightMetricLabel] ?? 0)),
    label: LABEL_RIGHT,
    itemStyle: { opacity: getOpacity(categoryKeys[i]) },
  }));

  const labelFormatter = (params: CallbackDataParams) => {
    const value = Math.abs(params.value as number);

    if (value === 0) {
      return '';
    }

    return defaultFormatter(value);
  };

  const series: BarSeriesOption[] = [
    {
      name: leftSeriesName,
      type: 'bar',
      stack: 'Total',
      label: {
        show: showValue,
        formatter: labelFormatter,
        color: theme.colorText,
      },
      itemStyle: {
        color: rgbToHex(leftColor.r, leftColor.g, leftColor.b),
      },
      data: leftData,
    },
    {
      name: rightSeriesName,
      type: 'bar',
      stack: 'Total',
      label: {
        show: showValue,
        formatter: labelFormatter,
        color: theme.colorText,
      },
      itemStyle: {
        color: rgbToHex(rightColor.r, rightColor.g, rightColor.b),
      },
      data: rightData,
    },
  ];

  const legendData = [leftSeriesName, rightSeriesName].sort((a, b) => {
    if (!legendSort) {
      return 0;
    }
    return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  });

  const { effectiveLegendMargin, effectiveLegendType } = resolveLegendLayout({
    chartHeight: height,
    chartWidth: width,
    legendItems: legendData,
    legendMargin,
    orientation: legendOrientation,
    show: showLegend,
    theme,
    type: legendType,
  });

  const legendPadding = getChartPadding(
    showLegend,
    legendOrientation,
    effectiveLegendMargin,
    undefined,
    true,
  );

  const echartOptions: EChartsOption = {
    grid: {
      ...defaultGrid,
      top:
        theme.sizeUnit * 5 +
        legendPadding.top +
        convertInteger(xAxisTitleMargin),
      bottom: theme.sizeUnit * 5 + legendPadding.bottom,
      left:
        theme.sizeUnit * 5 +
        legendPadding.left +
        convertInteger(yAxisTitleMargin),
      right: theme.sizeUnit * 5 + legendPadding.right,
    },
    legend: {
      ...getLegendProps(
        effectiveLegendType,
        legendOrientation,
        showLegend,
        theme,
        false,
        legendState,
      ),
      data: legendData,
    },
    xAxis: {
      type: 'value',
      position: 'top',
      name: xAxisLabel,
      nameLocation: 'middle',
      nameGap: convertInteger(xAxisTitleMargin),
      nameTextStyle: {
        padding: [theme.sizeUnit * 4, 0, 0, 0],
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      axisLabel: {
        formatter: (value: number) => defaultFormatter(Math.abs(value)),
      },
    },
    yAxis: {
      type: 'category',
      name: yAxisLabel,
      nameLocation: 'middle',
      nameGap: convertInteger(yAxisTitleMargin),
      nameTextStyle: {
        padding: [0, theme.sizeUnit * 4, 0, 0],
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        rotate: xAxisLabelRotation,
      },
      data: categories,
    },
    tooltip: {
      ...getDefaultTooltip(refs),
      appendToBody: true,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      show: !inContextMenu,
      formatter: (params: CallbackDataParams | CallbackDataParams[]) =>
        formatTooltip(
          ensureIsArray(params) as CallbackDataParams[],
          defaultFormatter,
          categories,
          categoryByKey,
        ),
    },
    series,
  };

  return {
    refs,
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    onContextMenu,
    onLegendStateChanged,
    groupby: groupbyColumns,
    labelMap,
    selectedValues,
    emitCrossFilters,
    coltypeMapping,
  };
}
