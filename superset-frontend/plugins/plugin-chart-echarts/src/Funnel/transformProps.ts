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
  CategoricalColorNamespace,
  DataRecordValue,
  DataRecord,
  getMetricLabel,
  getNumberFormatter,
  NumberFormats,
  NumberFormatter,
  getColumnLabel,
} from '@superset-ui/core';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { EChartsCoreOption, FunnelSeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA as DEFAULT_FUNNEL_FORM_DATA,
  EchartsFunnelChartProps,
  EchartsFunnelFormData,
  EchartsFunnelLabelTypeType,
  FunnelChartTransformedProps,
} from './types';
import { DEFAULT_LEGEND_FORM_DATA } from '../types';
import {
  extractGroupbyLabel,
  getChartPadding,
  getLegendProps,
  sanitizeHtml,
} from '../utils/series';
import { defaultGrid, defaultTooltip } from '../defaults';
import { OpacityEnum } from '../constants';

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function formatFunnelLabel({
  params,
  labelType,
  numberFormatter,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent'>;
  labelType: EchartsFunnelLabelTypeType;
  numberFormatter: NumberFormatter;
  sanitizeName?: boolean;
}): string {
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);
  switch (labelType) {
    case EchartsFunnelLabelTypeType.Key:
      return name;
    case EchartsFunnelLabelTypeType.Value:
      return formattedValue;
    case EchartsFunnelLabelTypeType.Percent:
      return formattedPercent;
    case EchartsFunnelLabelTypeType.KeyValue:
      return `${name}: ${formattedValue}`;
    case EchartsFunnelLabelTypeType.KeyValuePercent:
      return `${name}: ${formattedValue} (${formattedPercent})`;
    case EchartsFunnelLabelTypeType.KeyPercent:
      return `${name}: ${formattedPercent}`;
    default:
      return name;
  }
}

export default function transformProps(
  chartProps: EchartsFunnelChartProps,
): FunnelChartTransformedProps {
  const { formData, height, hooks, filterState, queriesData, width } =
    chartProps;
  const data: DataRecord[] = queriesData[0].data || [];

  const {
    colorScheme,
    groupby,
    orient,
    sort,
    gap,
    labelLine,
    labelType,
    legendMargin,
    legendOrientation,
    legendType,
    metric = '',
    numberFormat,
    showLabels,
    showLegend,
    emitFilter,
  }: EchartsFunnelFormData = {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_FUNNEL_FORM_DATA,
    ...formData,
  };
  const metricLabel = getMetricLabel(metric);
  const groupbyLabels = groupby.map(getColumnLabel);
  const keys = data.map(datum =>
    extractGroupbyLabel({ datum, groupby: groupbyLabels, coltypeMapping: {} }),
  );
  const labelMap = data.reduce(
    (acc: Record<string, DataRecordValue[]>, datum) => {
      const label = extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping: {},
      });
      return {
        ...acc,
        [label]: groupbyLabels.map(col => datum[col]),
      };
    },
    {},
  );

  const { setDataMask = () => {} } = hooks;

  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getNumberFormatter(numberFormat);

  const transformedData: FunnelSeriesOption[] = data.map(datum => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping: {},
    });
    const isFiltered =
      filterState.selectedValues && !filterState.selectedValues.includes(name);
    return {
      value: datum[metricLabel],
      name,
      itemStyle: {
        color: colorFn(name),
        opacity: isFiltered
          ? OpacityEnum.SemiTransparent
          : OpacityEnum.NonTransparent,
      },
    };
  });

  const selectedValues = (filterState.selectedValues || []).reduce(
    (acc: Record<string, number>, selectedValue: string) => {
      const index = transformedData.findIndex(
        ({ name }) => name === selectedValue,
      );
      return {
        ...acc,
        [index]: selectedValue,
      };
    },
    {},
  );

  const formatter = (params: CallbackDataParams) =>
    formatFunnelLabel({ params, numberFormatter, labelType });

  const defaultLabel = {
    formatter,
    show: showLabels,
    color: '#000000',
  };

  const series: FunnelSeriesOption[] = [
    {
      type: 'funnel',
      ...getChartPadding(showLegend, legendOrientation, legendMargin),
      animation: true,
      minSize: '0%',
      maxSize: '100%',
      sort,
      orient,
      gap,
      funnelAlign: 'center',
      labelLine: { show: !!labelLine },
      label: {
        ...defaultLabel,
        position: labelLine ? 'outer' : 'inner',
        textBorderColor: 'transparent',
      },
      emphasis: {
        label: {
          show: true,
          fontWeight: 'bold',
        },
      },
      // @ts-ignore
      data: transformedData,
    },
  ];

  const echartOptions: EChartsCoreOption = {
    grid: {
      ...defaultGrid,
    },
    tooltip: {
      ...defaultTooltip,
      trigger: 'item',
      formatter: (params: any) =>
        formatFunnelLabel({
          params,
          numberFormatter,
          labelType: EchartsFunnelLabelTypeType.KeyValuePercent,
        }),
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend),
      data: keys,
    },
    series,
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitFilter,
    labelMap,
    groupby,
    selectedValues,
  };
}
