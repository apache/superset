/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law of an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  CategoricalColorNamespace,
  ChartProps,
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  NumberFormats,
  ValueFormatter,
  ChartDataResponseResult,
} from '@superset-ui/core';

import type { BarSeriesOption, EChartsOption } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import { LegendOrientation } from '@superset-ui/plugin-chart-echarts';
import {
  DEFAULT_FORM_DATA, // <-- This now correctly points to your local file
  DrilldownBarFormData,
  BarChartTransformedProps,
  BarChartDataItem,
  EchartsBarLabelType,
} from './types';
import {
  extractGroupbyLabel,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
} from './utils/series';
import { defaultGrid } from './defaults';
import { LegendType } from '@superset-ui/plugin-chart-echarts';
import { ensureIsCurrency } from './constants';

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function parseParams({
  params,
  numberFormatter,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent'> & {
    [key: string]: any;
  };
  numberFormatter: ValueFormatter;
  sanitizeName?: boolean;
}): string[] {
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);
  return [name, formattedValue, formattedPercent];
}

export default function transformProps(
  chartProps: ChartProps<DrilldownBarFormData>,
): BarChartTransformedProps {
  const { width, height, queriesData, formData, theme } = chartProps;

  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(
    queriesData[0] as ChartDataResponseResult,
  );

  const {
    groupby,
    metric,
    colorScheme,
    legendState,
    legendType,
    legendOrientation,
    showLabels,
    labelType,
    labelRotation,
    stack,
    columnFormats = {} as Record<string, string>,
    numberFormat = '' as string,
    currencyFormat = '' as string,
  } = { ...DEFAULT_FORM_DATA, ...formData };

  const showLegend = legendState === 'on';

  const groupbyLabels = (groupby || []).map(getColumnLabel);
  const metricLabel = metric ? getMetricLabel(metric) : '';
  const metricKey =
    typeof metric === 'string'
      ? metric
      : (metric as unknown as { label?: string })?.label || '';

  const numberFormatter = getValueFormatter(
    metricKey,
    formData.currency_formats ?? {},
    columnFormats ?? {},
    numberFormat,
    ensureIsCurrency(currencyFormat),
  );

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const transformedData: BarChartDataItem[] = data.map((datum: DataRecord) => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
    });
    const value = datum[metricLabel];
    return {
      name,
      value,
      itemStyle: {
        color: colorFn(name),
      },
    };
  });

  const series: BarSeriesOption = {
    type: 'bar',
    data: transformedData,
    label: {
      show: showLabels,
      rotate: labelRotation,
      formatter: (params: CallbackDataParams) => {
        const [name, formattedValue] = parseParams({
          params,
          numberFormatter,
        });
        switch (labelType) {
          case EchartsBarLabelType.Key:
            return name;
          case EchartsBarLabelType.Value:
            return formattedValue;
          case EchartsBarLabelType.KeyValue:
            return `${name}: ${formattedValue}`;
          default:
            return '';
        }
      },
    },
    emphasis: {
      focus: 'series',
    },
    stack: stack ? 'total' : undefined,
  };

  const echartOptions: EChartsOption = {
    grid: defaultGrid,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: getLegendProps(
      legendType as LegendType,
      (legendOrientation as LegendOrientation) ?? LegendOrientation.Top,
      showLegend ?? false,
      theme,
    ) as NonNullable<EChartsOption['legend']>,
    xAxis: {
      type: 'category',
      data: transformedData.map(d => d.name),
    },
    yAxis: {
      type: 'value',
    },
    series: [series],
  };

  return {
    ...chartProps,
    width,
    height,
    formData,
    echartOptions,
    drilldownData: {
      sourceData: data,
      hierarchy: groupbyLabels,
      metric: metricLabel,
    },
    hooks: {
      ...(chartProps.hooks || {}),
      onContextMenu: chartProps.hooks?.onContextMenu,
    },
  };
}
