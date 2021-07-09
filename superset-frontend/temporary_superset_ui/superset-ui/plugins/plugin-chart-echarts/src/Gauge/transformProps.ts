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
  getNumberFormatter,
  getMetricLabel,
  DataRecordValue,
} from '@superset-ui/core';
import { EChartsOption, GaugeSeriesOption } from 'echarts';
import { GaugeDataItemOption } from 'echarts/types/src/chart/gauge/GaugeSeries';
import range from 'lodash/range';
import { parseNumbersList } from '../utils/controls';
import {
  DEFAULT_FORM_DATA as DEFAULT_GAUGE_FORM_DATA,
  EchartsGaugeFormData,
  AxisTickLineStyle,
  GaugeChartTransformedProps,
  EchartsGaugeChartProps,
} from './types';
import {
  DEFAULT_GAUGE_SERIES_OPTION,
  INTERVAL_GAUGE_SERIES_OPTION,
  OFFSETS,
  FONT_SIZE_MULTIPLIERS,
} from './constants';
import { OpacityEnum } from '../constants';

const setIntervalBoundsAndColors = (
  intervals: string,
  intervalColorIndices: string,
  colorFn: CategoricalColorScale,
  normalizer: number,
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

  const intervalBounds = intervalBoundsNonNormalized.map(bound => bound / normalizer);
  const intervalColors = intervalColorIndicesArray.map(
    ind => colorFn.colors[(ind - 1) % colorFn.colors.length],
  );

  return intervalBounds.map((val, idx) => {
    const color = intervalColors[idx];
    return [val, color || colorFn.colors[idx]];
  });
};

const calculateAxisLineWidth = (data: DataRecord[], fontSize: number, overlap: boolean): number =>
  overlap ? fontSize : data.length * fontSize;

export default function transformProps(
  chartProps: EchartsGaugeChartProps,
): GaugeChartTransformedProps {
  const { width, height, formData, queriesData, hooks, filterState } = chartProps;
  const {
    groupby,
    metric,
    minVal,
    maxVal,
    colorScheme,
    fontSize,
    numberFormat,
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
    emitFilter,
  }: EchartsGaugeFormData = { ...DEFAULT_GAUGE_FORM_DATA, ...formData };
  const data = (queriesData[0]?.data || []) as DataRecord[];
  const numberFormatter = getNumberFormatter(numberFormat);
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
  const normalizer = maxVal;
  const axisLineWidth = calculateAxisLineWidth(data, fontSize, overlap);
  const axisLabels = range(minVal, maxVal, (maxVal - minVal) / splitNumber);
  const axisLabelLength = Math.max(
    ...axisLabels.map(label => numberFormatter(label).length).concat([1]),
  );
  const formatValue = (value: number) => valueFormatter.replace('{value}', numberFormatter(value));
  const axisTickLength = FONT_SIZE_MULTIPLIERS.axisTickLength * fontSize;
  const splitLineLength = FONT_SIZE_MULTIPLIERS.splitLineLength * fontSize;
  const titleOffsetFromTitle = FONT_SIZE_MULTIPLIERS.titleOffsetFromTitle * fontSize;
  const detailOffsetFromTitle = FONT_SIZE_MULTIPLIERS.detailOffsetFromTitle * fontSize;
  const intervalBoundsAndColors = setIntervalBoundsAndColors(
    intervals,
    intervalColorIndices,
    colorFn,
    normalizer,
  );
  const columnsLabelMap = new Map<string, DataRecordValue[]>();

  const transformedData: GaugeDataItemOption[] = data.map((data_point, index) => {
    const name = groupby.map(column => `${column}: ${data_point[column]}`).join(', ');
    columnsLabelMap.set(
      name,
      groupby.map(col => data_point[col]),
    );
    let item: GaugeDataItemOption = {
      value: data_point[getMetricLabel(metric as QueryFormMetric)] as number,
      name,
      itemStyle: {
        color: colorFn(index),
      },
      title: {
        offsetCenter: ['0%', `${index * titleOffsetFromTitle + OFFSETS.titleFromCenter}%`],
        fontSize,
      },
      detail: {
        offsetCenter: [
          '0%',
          `${index * titleOffsetFromTitle + OFFSETS.titleFromCenter + detailOffsetFromTitle}%`,
        ],
        fontSize: FONT_SIZE_MULTIPLIERS.detailFontSize * fontSize,
      },
    };
    if (filterState.selectedValues && !filterState.selectedValues.includes(name)) {
      item = {
        ...item,
        itemStyle: {
          color: colorFn(index),
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
  });

  const { setDataMask = () => {} } = hooks;

  const progress = {
    show: showProgress,
    overlap,
    roundCap,
    width: fontSize,
  };
  const splitLine = {
    show: showSplitLine,
    distance: -axisLineWidth - splitLineLength - OFFSETS.ticksFromLine,
    length: splitLineLength,
    lineStyle: {
      width: FONT_SIZE_MULTIPLIERS.splitLineWidth * fontSize,
      color: DEFAULT_GAUGE_SERIES_OPTION.splitLine?.lineStyle?.color,
    },
  };
  const axisLine = {
    roundCap,
    lineStyle: {
      width: axisLineWidth,
      color: DEFAULT_GAUGE_SERIES_OPTION.axisLine?.lineStyle?.color,
    },
  };
  const axisLabel = {
    distance:
      axisLineWidth -
      FONT_SIZE_MULTIPLIERS.axisLabelDistance *
        fontSize *
        FONT_SIZE_MULTIPLIERS.axisLabelLength *
        axisLabelLength -
      (showSplitLine ? splitLineLength : 0) -
      (showAxisTick ? axisTickLength : 0) -
      OFFSETS.ticksFromLine,
    fontSize,
    formatter: numberFormatter,
    color: DEFAULT_GAUGE_SERIES_OPTION.axisLabel?.color,
  };
  const axisTick = {
    show: showAxisTick,
    distance: -axisLineWidth - axisTickLength - OFFSETS.ticksFromLine,
    length: axisTickLength,
    lineStyle: DEFAULT_GAUGE_SERIES_OPTION.axisTick?.lineStyle as AxisTickLineStyle,
  };
  const detail = {
    valueAnimation: animation,
    formatter: (value: number) => formatValue(value),
    color: DEFAULT_GAUGE_SERIES_OPTION.detail?.color,
  };
  let pointer;

  if (intervalBoundsAndColors.length) {
    splitLine.lineStyle.color = INTERVAL_GAUGE_SERIES_OPTION.splitLine?.lineStyle?.color;
    axisTick.lineStyle.color = INTERVAL_GAUGE_SERIES_OPTION?.axisTick?.lineStyle?.color as string;
    axisLabel.color = INTERVAL_GAUGE_SERIES_OPTION.axisLabel?.color;
    axisLine.lineStyle.color = intervalBoundsAndColors;
    pointer = {
      show: showPointer,
      itemStyle: INTERVAL_GAUGE_SERIES_OPTION.pointer?.itemStyle,
    };
  } else {
    pointer = {
      show: showPointer,
    };
  }

  const series: GaugeSeriesOption[] = [
    {
      type: 'gauge',
      startAngle,
      endAngle,
      min: minVal,
      max: maxVal,
      progress,
      animation,
      axisLine: axisLine as GaugeSeriesOption['axisLine'],
      splitLine,
      splitNumber,
      axisLabel,
      axisTick,
      pointer,
      detail,
      data: transformedData,
    },
  ];

  const echartOptions: EChartsOption = {
    series,
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    emitFilter,
    labelMap: Object.fromEntries(columnsLabelMap),
    groupby,
    selectedValues: filterState.selectedValues || [],
  };
}
