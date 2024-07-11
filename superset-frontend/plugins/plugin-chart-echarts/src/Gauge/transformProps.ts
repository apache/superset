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
  QueryFormMetric,
  CategoricalColorNamespace,
  CategoricalColorScale,
  DataRecord,
  getMetricLabel,
  getColumnLabel,
  getValueFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { EChartsCoreOption, GaugeSeriesOption } from 'echarts';
import { GaugeDataItemOption } from 'echarts/types/src/chart/gauge/GaugeSeries';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import { range } from 'lodash';
import { parseNumbersList } from '../utils/controls';
import {
  DEFAULT_FORM_DATA as DEFAULT_GAUGE_FORM_DATA,
  EchartsGaugeFormData,
  AxisTickLineStyle,
  GaugeChartTransformedProps,
  EchartsGaugeChartProps,
} from './types';
import {
  defaultGaugeSeriesOption,
  INTERVAL_GAUGE_SERIES_OPTION,
  OFFSETS,
  FONT_SIZE_MULTIPLIERS,
} from './constants';
import { OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { getColtypesMapping } from '../utils/series';

export const getIntervalBoundsAndColors = (
  intervals: string,
  intervalColorIndices: string,
  colorFn: CategoricalColorScale,
  min: number,
  max: number,
): Array<[number, string]> => {
  let intervalBoundsNonNormalized;
  let intervalColorIndicesArray;
  try {
    intervalBoundsNonNormalized = parseNumbersList(intervals, ',');
    intervalColorIndicesArray = parseNumbersList(intervalColorIndices, ',');
  } catch (error) {
    intervalBoundsNonNormalized = [] as number[];
    intervalColorIndicesArray = [] as number[];
  }

  const intervalBounds = intervalBoundsNonNormalized.map(
    bound => (bound - min) / (max - min),
  );
  const intervalColors = intervalColorIndicesArray.map(
    ind => colorFn.colors[(ind - 1) % colorFn.colors.length],
  );

  return intervalBounds.map((val, idx) => {
    const color = intervalColors[idx];
    return [val, color || colorFn.colors[idx]];
  });
};

const calculateAxisLineWidth = (
  data: DataRecord[],
  fontSize: number,
  overlap: boolean,
): number => (overlap ? fontSize : data.length * fontSize);

const calculateMin = (data: GaugeDataItemOption[]) =>
  2 * Math.min(...data.map(d => d.value as number).concat([0]));

const calculateMax = (data: GaugeDataItemOption[]) =>
  2 * Math.max(...data.map(d => d.value as number).concat([0]));

export default function transformProps(
  chartProps: EchartsGaugeChartProps,
): GaugeChartTransformedProps {
  const {
    width,
    height,
    formData,
    queriesData,
    hooks,
    filterState,
    theme,
    emitCrossFilters,
    datasource,
  } = chartProps;

  const gaugeSeriesOptions = defaultGaugeSeriesOption(theme);
  const {
    verboseMap = {},
    currencyFormats = {},
    columnFormats = {},
  } = datasource;
  const {
    groupby,
    metric,
    minVal,
    maxVal,
    colorScheme,
    fontSize,
    numberFormat,
    currencyFormat,
    animation,
    showProgress,
    overlap,
    roundCap,
    showAxisTick,
    showSplitLine,
    splitNumber,
    startAngle,
    endAngle,
    showPointer,
    intervals,
    intervalColorIndices,
    valueFormatter,
    sliceId,
  }: EchartsGaugeFormData = { ...DEFAULT_GAUGE_FORM_DATA, ...formData };
  const refs: Refs = {};
  const data = (queriesData[0]?.data || []) as DataRecord[];
  const coltypeMapping = getColtypesMapping(queriesData[0]);
  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    numberFormat,
    currencyFormat,
  );
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const axisLineWidth = calculateAxisLineWidth(data, fontSize, overlap);
  const groupbyLabels = groupby.map(getColumnLabel);
  const formatValue = (value: number) =>
    valueFormatter.replace('{value}', numberFormatter(value));
  const axisTickLength = FONT_SIZE_MULTIPLIERS.axisTickLength * fontSize;
  const splitLineLength = FONT_SIZE_MULTIPLIERS.splitLineLength * fontSize;
  const titleOffsetFromTitle =
    FONT_SIZE_MULTIPLIERS.titleOffsetFromTitle * fontSize;
  const detailOffsetFromTitle =
    FONT_SIZE_MULTIPLIERS.detailOffsetFromTitle * fontSize;
  const columnsLabelMap = new Map<string, string[]>();
  const metricLabel = getMetricLabel(metric as QueryFormMetric);

  const transformedData: GaugeDataItemOption[] = data.map(
    (data_point, index) => {
      const name = groupbyLabels
        .map(column => `${verboseMap[column] || column}: ${data_point[column]}`)
        .join(', ');
      columnsLabelMap.set(
        name,
        groupbyLabels.map(col => data_point[col] as string),
      );
      let item: GaugeDataItemOption = {
        value: data_point[metricLabel] as number,
        name,
        itemStyle: {
          color: colorFn(index, sliceId, colorScheme),
        },
        title: {
          offsetCenter: [
            '0%',
            `${index * titleOffsetFromTitle + OFFSETS.titleFromCenter}%`,
          ],
          fontSize,
        },
        detail: {
          offsetCenter: [
            '0%',
            `${
              index * titleOffsetFromTitle +
              OFFSETS.titleFromCenter +
              detailOffsetFromTitle
            }%`,
          ],
          fontSize: FONT_SIZE_MULTIPLIERS.detailFontSize * fontSize,
        },
      };
      if (
        filterState.selectedValues &&
        !filterState.selectedValues.includes(name)
      ) {
        item = {
          ...item,
          itemStyle: {
            color: colorFn(index, sliceId, colorScheme),
            opacity: OpacityEnum.SemiTransparent,
          },
          detail: {
            show: false,
          },
          title: {
            show: false,
          },
        };
      }
      return item;
    },
  );

  const { setDataMask = () => {}, onContextMenu } = hooks;

  const min = minVal ?? calculateMin(transformedData);
  const max = maxVal ?? calculateMax(transformedData);
  const axisLabels = range(min, max, (max - min) / splitNumber);
  const axisLabelLength = Math.max(
    ...axisLabels.map(label => numberFormatter(label).length).concat([1]),
  );
  const intervalBoundsAndColors = getIntervalBoundsAndColors(
    intervals,
    intervalColorIndices,
    colorFn,
    min,
    max,
  );
  const splitLineDistance =
    axisLineWidth + splitLineLength + OFFSETS.ticksFromLine;
  const axisLabelDistance =
    FONT_SIZE_MULTIPLIERS.axisLabelDistance *
      fontSize *
      FONT_SIZE_MULTIPLIERS.axisLabelLength *
      axisLabelLength +
    (showSplitLine ? splitLineLength : 0) +
    (showAxisTick ? axisTickLength : 0) +
    OFFSETS.ticksFromLine -
    axisLineWidth;
  const axisTickDistance =
    axisLineWidth + axisTickLength + OFFSETS.ticksFromLine;

  const progress = {
    show: showProgress,
    overlap,
    roundCap,
    width: fontSize,
  };
  const splitLine = {
    show: showSplitLine,
    distance: -splitLineDistance,
    length: splitLineLength,
    lineStyle: {
      width: FONT_SIZE_MULTIPLIERS.splitLineWidth * fontSize,
      color: gaugeSeriesOptions.splitLine?.lineStyle?.color,
    },
  };
  const axisLine = {
    roundCap,
    lineStyle: {
      width: axisLineWidth,
      color: gaugeSeriesOptions.axisLine?.lineStyle?.color,
    },
  };
  const axisLabel = {
    distance: -axisLabelDistance,
    fontSize,
    formatter: numberFormatter,
    color: gaugeSeriesOptions.axisLabel?.color,
  };
  const axisTick = {
    show: showAxisTick,
    distance: -axisTickDistance,
    length: axisTickLength,
    lineStyle: gaugeSeriesOptions.axisTick?.lineStyle as AxisTickLineStyle,
  };
  const detail = {
    valueAnimation: animation,
    formatter: (value: number) => formatValue(value),
    color: gaugeSeriesOptions.detail?.color,
  };
  const tooltip = {
    ...getDefaultTooltip(refs),
    formatter: (params: CallbackDataParams) => {
      const { name, value } = params;
      return tooltipHtml([[metricLabel, formatValue(value as number)]], name);
    },
  };

  let pointer;
  if (intervalBoundsAndColors.length) {
    splitLine.lineStyle.color =
      INTERVAL_GAUGE_SERIES_OPTION.splitLine?.lineStyle?.color;
    axisTick.lineStyle.color = INTERVAL_GAUGE_SERIES_OPTION?.axisTick?.lineStyle
      ?.color as string;
    axisLabel.color = INTERVAL_GAUGE_SERIES_OPTION.axisLabel?.color;
    axisLine.lineStyle.color = intervalBoundsAndColors;
    pointer = {
      show: showPointer,
      showAbove: false,
      itemStyle: INTERVAL_GAUGE_SERIES_OPTION.pointer?.itemStyle,
    };
  } else {
    pointer = {
      show: showPointer,
      showAbove: false,
    };
  }

  const series: GaugeSeriesOption[] = [
    {
      type: 'gauge',
      startAngle,
      endAngle,
      min,
      max,
      progress,
      animation,
      axisLine: axisLine as GaugeSeriesOption['axisLine'],
      splitLine,
      splitNumber,
      axisLabel,
      axisTick,
      pointer,
      detail,
      // @ts-ignore
      tooltip,
      radius:
        Math.min(width, height) / 2 - axisLabelDistance - axisTickDistance,
      center: ['50%', '55%'],
      data: transformedData,
    },
  ];

  const echartOptions: EChartsCoreOption = {
    tooltip: {
      ...getDefaultTooltip(refs),
      trigger: 'item',
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
    labelMap: Object.fromEntries(columnsLabelMap),
    groupby,
    selectedValues: filterState.selectedValues || [],
    onContextMenu,
    refs,
    coltypeMapping,
  };
}
