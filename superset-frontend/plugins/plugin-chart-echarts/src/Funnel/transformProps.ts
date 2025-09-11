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
  DataRecord,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getValueFormatter,
  NumberFormats,
  tooltipHtml,
  ValueFormatter,
} from '@superset-ui/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { EChartsCoreOption } from 'echarts/core';
import type { FunnelSeriesOption } from 'echarts/charts';
import {
  DEFAULT_FORM_DATA as DEFAULT_FUNNEL_FORM_DATA,
  EchartsFunnelChartProps,
  EchartsFunnelFormData,
  EchartsFunnelLabelTypeType,
  FunnelChartTransformedProps,
  PercentCalcType,
} from './types';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
} from '../utils/series';
import { defaultGrid } from '../defaults';
import { DEFAULT_LEGEND_FORM_DATA, OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function parseParams({
  params,
  numberFormatter,
  percentCalculationType = PercentCalcType.FirstStep,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent' | 'data'>;
  numberFormatter: ValueFormatter;
  percentCalculationType?: PercentCalcType;
  sanitizeName?: boolean;
}) {
  const { name: rawName = '', value, percent: totalPercent, data } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const { firstStepPercent, prevStepPercent } = data as {
    firstStepPercent: number;
    prevStepPercent: number;
  };
  let percent;

  if (percentCalculationType === PercentCalcType.Total) {
    percent = (totalPercent ?? 0) / 100;
  } else if (percentCalculationType === PercentCalcType.PreviousStep) {
    percent = prevStepPercent ?? 0;
  } else {
    percent = firstStepPercent ?? 0;
  }
  const formattedPercent = percentFormatter(percent);
  return [name, formattedValue, formattedPercent];
}

export default function transformProps(
  chartProps: EchartsFunnelChartProps,
): FunnelChartTransformedProps {
  const {
    formData,
    height,
    hooks,
    filterState,
    queriesData,
    width,
    theme,
    emitCrossFilters,
    datasource,
  } = chartProps;
  const data: DataRecord[] = queriesData[0].data || [];
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const {
    colorScheme,
    groupby,
    orient,
    sort,
    gap,
    labelLine,
    labelType,
    tooltipLabelType,
    legendMargin,
    legendOrientation,
    legendType,
    metric = '',
    numberFormat,
    currencyFormat,
    showLabels,
    inContextMenu,
    showTooltipLabels,
    showLegend,
    sliceId,
    percentCalculationType,
  }: EchartsFunnelFormData = {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_FUNNEL_FORM_DATA,
    ...formData,
  };
  const { currencyFormats = {}, columnFormats = {} } = datasource;
  const refs: Refs = {};
  const metricLabel = getMetricLabel(metric);
  const groupbyLabels = groupby.map(getColumnLabel);
  const keys = data.map(datum =>
    extractGroupbyLabel({ datum, groupby: groupbyLabels, coltypeMapping: {} }),
  );
  const labelMap = data.reduce((acc: Record<string, string[]>, datum) => {
    const label = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping: {},
    });
    return {
      ...acc,
      [label]: groupbyLabels.map(col => datum[col] as string),
    };
  }, {});

  const { setDataMask = () => {}, onContextMenu } = hooks;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    numberFormat,
    currencyFormat,
  );

  const transformedData: {
    value: number;
    name: string;
    itemStyle: { color: string; opacity: OpacityEnum };
  }[] = data.map((datum, index) => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping: {},
    });
    const value = datum[metricLabel] as number;
    const isFiltered =
      filterState.selectedValues && !filterState.selectedValues.includes(name);
    const firstStepPercent = value / (data[0][metricLabel] as number);
    const prevStepPercent =
      index === 0 ? 1 : value / (data[index - 1][metricLabel] as number);
    return {
      value,
      name,
      itemStyle: {
        color: colorFn(name, sliceId),
        opacity: isFiltered
          ? OpacityEnum.SemiTransparent
          : OpacityEnum.NonTransparent,
      },
      firstStepPercent,
      prevStepPercent,
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

  const formatter = (params: CallbackDataParams) => {
    const [name, formattedValue, formattedPercent] = parseParams({
      params,
      numberFormatter,
      percentCalculationType,
    });
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
      case EchartsFunnelLabelTypeType.ValuePercent:
        return `${formattedValue} (${formattedPercent})`;
      default:
        return name;
    }
  };

  const defaultLabel = {
    formatter,
    show: showLabels,
    color: theme.colors.grayscale.dark2,
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
      ...getDefaultTooltip(refs),
      show: !inContextMenu && showTooltipLabels,
      trigger: 'item',
      formatter: (params: any) => {
        const [name, formattedValue, formattedPercent] = parseParams({
          params,
          numberFormatter,
          percentCalculationType,
        });
        const row = [];
        const enumName = EchartsFunnelLabelTypeType[tooltipLabelType];
        const title = enumName.includes('Key') ? name : undefined;
        if (enumName.includes('Value') || enumName.includes('Percent')) {
          row.push(metricLabel);
        }
        if (enumName.includes('Value')) {
          row.push(formattedValue);
        }
        if (enumName.includes('Percent')) {
          row.push(formattedPercent);
        }
        return tooltipHtml([row], title);
      },
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, theme),
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
    emitCrossFilters,
    labelMap,
    groupby,
    selectedValues,
    onContextMenu,
    refs,
    coltypeMapping,
  };
}
