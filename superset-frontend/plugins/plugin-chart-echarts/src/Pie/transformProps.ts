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
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  NumberFormats,
  NumberFormatter,
} from '@superset-ui/core';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { EChartsCoreOption, PieSeriesOption } from 'echarts';
import {
  DEFAULT_FORM_DATA as DEFAULT_PIE_FORM_DATA,
  EchartsPieChartProps,
  EchartsPieFormData,
  EchartsPieLabelType,
  PieChartTransformedProps,
} from './types';
import { DEFAULT_LEGEND_FORM_DATA } from '../types';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
} from '../utils/series';
import { defaultGrid, defaultTooltip } from '../defaults';
import { OpacityEnum } from '../constants';

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function formatPieLabel({
  params,
  labelType,
  numberFormatter,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent'>;
  labelType: EchartsPieLabelType;
  numberFormatter: NumberFormatter;
  sanitizeName?: boolean;
}): string {
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);

  switch (labelType) {
    case EchartsPieLabelType.Key:
      return name;
    case EchartsPieLabelType.Value:
      return formattedValue;
    case EchartsPieLabelType.Percent:
      return formattedPercent;
    case EchartsPieLabelType.KeyValue:
      return `${name}: ${formattedValue}`;
    case EchartsPieLabelType.KeyValuePercent:
      return `${name}: ${formattedValue} (${formattedPercent})`;
    case EchartsPieLabelType.KeyPercent:
      return `${name}: ${formattedPercent}`;
    default:
      return name;
  }
}

export default function transformProps(
  chartProps: EchartsPieChartProps,
): PieChartTransformedProps {
  const { formData, height, hooks, filterState, queriesData, width } =
    chartProps;
  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);

  const {
    colorScheme,
    donut,
    groupby,
    innerRadius,
    labelsOutside,
    labelLine,
    labelType,
    legendMargin,
    legendOrientation,
    legendType,
    metric = '',
    numberFormat,
    dateFormat,
    outerRadius,
    showLabels,
    showLegend,
    showLabelsThreshold,
    emitFilter,
    sliceId,
  }: EchartsPieFormData = {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_PIE_FORM_DATA,
    ...formData,
  };
  const metricLabel = getMetricLabel(metric);
  const groupbyLabels = groupby.map(getColumnLabel);
  const minShowLabelAngle = (showLabelsThreshold || 0) * 3.6;

  const keys = data.map(datum =>
    extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat),
    }),
  );
  const labelMap = data.reduce(
    (acc: Record<string, DataRecordValue[]>, datum) => {
      const label = extractGroupbyLabel({
        datum,
        groupby: groupbyLabels,
        coltypeMapping,
        timeFormatter: getTimeFormatter(dateFormat),
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

  const transformedData: PieSeriesOption[] = data.map(datum => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat),
    });

    const isFiltered =
      filterState.selectedValues && !filterState.selectedValues.includes(name);

    return {
      value: datum[metricLabel],
      name,
      itemStyle: {
        color: colorFn(name, sliceId),
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
    formatPieLabel({
      params,
      numberFormatter,
      labelType,
    });

  const defaultLabel = {
    formatter,
    show: showLabels,
    color: '#000000',
  };

  const series: PieSeriesOption[] = [
    {
      type: 'pie',
      ...getChartPadding(showLegend, legendOrientation, legendMargin),
      animation: false,
      radius: [`${donut ? innerRadius : 0}%`, `${outerRadius}%`],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      labelLine: labelsOutside && labelLine ? { show: true } : { show: false },
      minShowLabelAngle,
      label: labelsOutside
        ? {
            ...defaultLabel,
            position: 'outer',
            alignTo: 'none',
            bleedMargin: 5,
          }
        : {
            ...defaultLabel,
            position: 'inner',
          },
      emphasis: {
        label: {
          show: true,
          fontWeight: 'bold',
          backgroundColor: 'white',
        },
      },
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
        formatPieLabel({
          params,
          numberFormatter,
          labelType: EchartsPieLabelType.KeyValuePercent,
          sanitizeName: true,
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
