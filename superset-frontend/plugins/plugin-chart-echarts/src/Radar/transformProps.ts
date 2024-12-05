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
  ensureIsInt,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  NumberFormatter,
} from '@superset-ui/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { RadarSeriesDataItemOption } from 'echarts/types/src/chart/radar/RadarSeries';
import type { EChartsCoreOption } from 'echarts/core';
import type { RadarSeriesOption } from 'echarts/charts';
import {
  DEFAULT_FORM_DATA as DEFAULT_RADAR_FORM_DATA,
  EchartsRadarChartProps,
  EchartsRadarFormData,
  EchartsRadarLabelType,
  RadarChartTransformedProps,
} from './types';
import { DEFAULT_LEGEND_FORM_DATA, OpacityEnum } from '../constants';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
} from '../utils/series';
import { defaultGrid } from '../defaults';
import { Refs } from '../types';
import { getDefaultTooltip } from '../utils/tooltip';

export function formatLabel({
  params,
  labelType,
  numberFormatter,
}: {
  params: CallbackDataParams;
  labelType: EchartsRadarLabelType;
  numberFormatter: NumberFormatter;
}): string {
  const { name = '', value } = params;
  const formattedValue = numberFormatter(value as number);

  switch (labelType) {
    case EchartsRadarLabelType.Value:
      return formattedValue;
    case EchartsRadarLabelType.KeyValue:
      return `${name}: ${formattedValue}`;
    default:
      return name;
  }
}

export default function transformProps(
  chartProps: EchartsRadarChartProps,
): RadarChartTransformedProps {
  const {
    formData,
    height,
    hooks,
    filterState,
    queriesData,
    width,
    theme,
    inContextMenu,
    emitCrossFilters,
  } = chartProps;
  const refs: Refs = {};
  const { data = [] } = queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);

  const {
    colorScheme,
    groupby,
    labelType,
    labelPosition,
    legendOrientation,
    legendType,
    legendMargin,
    metrics = [],
    numberFormat,
    dateFormat,
    showLabels,
    showLegend,
    isCircle,
    columnConfig,
    sliceId,
  }: EchartsRadarFormData = {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_RADAR_FORM_DATA,
    ...formData,
  };
  const { setDataMask = () => {}, onContextMenu } = hooks;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const numberFormatter = getNumberFormatter(numberFormat);
  const formatter = (params: CallbackDataParams) =>
    formatLabel({
      params,
      numberFormatter,
      labelType,
    });

  const metricLabels = metrics.map(getMetricLabel);
  const groupbyLabels = groupby.map(getColumnLabel);

  const metricLabelAndMaxValueMap = new Map<string, number>();
  const metricLabelAndMinValueMap = new Map<string, number>();
  const columnsLabelMap = new Map<string, string[]>();
  const transformedData: RadarSeriesDataItemOption[] = [];
  data.forEach(datum => {
    const joinedName = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat),
    });
    // map(joined_name: [columnLabel_1, columnLabel_2, ...])
    columnsLabelMap.set(
      joinedName,
      groupbyLabels.map(col => datum[col] as string),
    );

    // put max value of series into metricLabelAndMaxValueMap
    // eslint-disable-next-line no-restricted-syntax
    for (const [metricLabel, value] of Object.entries(datum)) {
      if (metricLabelAndMaxValueMap.has(metricLabel)) {
        metricLabelAndMaxValueMap.set(
          metricLabel,
          Math.max(
            value as number,
            ensureIsInt(
              metricLabelAndMaxValueMap.get(metricLabel),
              Number.MIN_SAFE_INTEGER,
            ),
          ),
        );
      } else {
        metricLabelAndMaxValueMap.set(metricLabel, value as number);
      }

      if (metricLabelAndMinValueMap.has(metricLabel)) {
        metricLabelAndMinValueMap.set(
          metricLabel,
          Math.min(
            value as number,
            ensureIsInt(
              metricLabelAndMinValueMap.get(metricLabel),
              Number.MAX_SAFE_INTEGER,
            ),
          ),
        );
      } else {
        metricLabelAndMinValueMap.set(metricLabel, value as number);
      }
    }

    const isFiltered =
      filterState.selectedValues &&
      !filterState.selectedValues.includes(joinedName);

    // generate transformedData
    transformedData.push({
      value: metricLabels.map(metricLabel => datum[metricLabel]),
      name: joinedName,
      itemStyle: {
        color: colorFn(joinedName, sliceId),
        opacity: isFiltered
          ? OpacityEnum.Transparent
          : OpacityEnum.NonTransparent,
      },
      lineStyle: {
        opacity: isFiltered
          ? OpacityEnum.SemiTransparent
          : OpacityEnum.NonTransparent,
      },
      label: {
        show: showLabels,
        position: labelPosition,
        formatter,
      },
    } as RadarSeriesDataItemOption);
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

  const indicator = metricLabels.map(metricLabel => {
    const maxValueInControl = columnConfig?.[metricLabel]?.radarMetricMaxValue;
    const minValueInControl = columnConfig?.[metricLabel]?.radarMetricMinValue;

    // Ensure that 0 is at the center of the polar coordinates
    const metricValueAsMax =
      metricLabelAndMaxValueMap.get(metricLabel) === 0
        ? Number.MAX_SAFE_INTEGER
        : metricLabelAndMaxValueMap.get(metricLabel);
    const max =
      maxValueInControl === null ? metricValueAsMax : maxValueInControl;

    let min: number;
    // If the min value doesn't exist, set it to 0 (default),
    // if it is null, set it to the min value of the data,
    // otherwise, use the value from the control
    if (minValueInControl === undefined) {
      min = 0;
    } else if (minValueInControl === null) {
      min = metricLabelAndMinValueMap.get(metricLabel) || 0;
    } else {
      min = minValueInControl;
    }

    return {
      name: metricLabel,
      max,
      min,
    };
  });

  const series: RadarSeriesOption[] = [
    {
      type: 'radar',
      ...getChartPadding(showLegend, legendOrientation, legendMargin),
      animation: false,
      emphasis: {
        label: {
          show: true,
          fontWeight: 'bold',
          backgroundColor: theme.colors.grayscale.light5,
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
      ...getDefaultTooltip(refs),
      show: !inContextMenu,
      trigger: 'item',
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, theme),
      data: Array.from(columnsLabelMap.keys()),
    },
    series,
    radar: {
      shape: isCircle ? 'circle' : 'polygon',
      indicator,
    },
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    emitCrossFilters,
    setDataMask,
    labelMap: Object.fromEntries(columnsLabelMap),
    groupby,
    selectedValues,
    onContextMenu,
    refs,
    coltypeMapping,
  };
}
