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
  CustomSeriesOption,
  CustomSeriesRenderItem,
  EChartsCoreOption,
  LineSeriesOption,
} from 'echarts';
import {
  AxisType,
  CategoricalColorNamespace,
  DataRecord,
  DataRecordValue,
  GenericDataType,
  getColumnLabel,
  getNumberFormatter,
  t,
  tooltipHtml,
} from '@superset-ui/core';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import dayjs from 'dayjs';
import {
  Cartesian2dCoordSys,
  EchartsGanttChartProps,
  EchartsGanttFormData,
} from './types';
import { DEFAULT_FORM_DATA, TIMESERIES_CONSTANTS } from '../constants';
import { Refs } from '../types';
import { getLegendProps, groupData } from '../utils/series';
import {
  getTooltipTimeFormatter,
  getXAxisFormatter,
} from '../utils/formatters';
import { defaultGrid } from '../defaults';
import { getPadding } from '../Timeseries/transformers';
import { convertInteger } from '../utils/convertInteger';
import { getTooltipLabels } from '../utils/tooltip';
import { Dimension, ELEMENT_HEIGHT_SCALE } from './constants';

const renderItem: CustomSeriesRenderItem = (params, api) => {
  const startX = api.value(Dimension.StartTime);
  const endX = api.value(Dimension.EndTime);
  const index = Number(api.value(Dimension.Index));
  const seriesCount = Number(api.value(Dimension.SeriesCount));

  if (Number.isNaN(index)) {
    return null;
  }

  const startY = seriesCount - 1 - index;
  const endY = startY - 1;

  const startCoord = api.coord([startX, startY]);
  const endCoord = api.coord([endX, endY]);

  const baseHeight = endCoord[1] - startCoord[1];
  const height = baseHeight * ELEMENT_HEIGHT_SCALE;

  const coordSys = params.coordSys as Cartesian2dCoordSys;
  const bounds = [coordSys.x, coordSys.x + coordSys.width];

  // left bound
  startCoord[0] = Math.max(startCoord[0], bounds[0]);
  endCoord[0] = Math.max(startCoord[0], endCoord[0]);
  // right bound
  startCoord[0] = Math.min(startCoord[0], bounds[1]);
  endCoord[0] = Math.min(endCoord[0], bounds[1]);

  const width = endCoord[0] - startCoord[0];

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    type: 'rect',
    transition: ['shape'],
    shape: {
      x: startCoord[0],
      y: startCoord[1] - height - (baseHeight - height) / 2,
      width,
      height,
    },
    style: api.style(),
  };
};

export default function transformProps(chartProps: EchartsGanttChartProps) {
  const {
    formData,
    queriesData,
    height,
    hooks,
    filterState,
    width,
    theme,
    emitCrossFilters,
    datasource,
    legendState,
  } = chartProps;

  const {
    startTime,
    endTime,
    yAxis,
    series: dimension,
    tooltipMetrics,
    tooltipColumns,
    xAxisTimeFormat,
    tooltipTimeFormat,
    tooltipValuesFormat,
    colorScheme,
    sliceId,
    zoomable,
    legendMargin,
    legendOrientation,
    legendType,
    showLegend,
    yAxisTitle,
    yAxisTitleMargin,
    xAxisTitle,
    xAxisTitleMargin,
    xAxisTimeBounds,
    subcategories,
  }: EchartsGanttFormData = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };

  const { setControlValue, onLegendStateChanged } = hooks;

  const { data = [], colnames = [], coltypes = [] } = queriesData[0];
  const refs: Refs = {};

  const startTimeLabel = getColumnLabel(startTime);
  const endTimeLabel = getColumnLabel(endTime);
  const yAxisLabel = getColumnLabel(yAxis);
  const dimensionLabel = dimension ? getColumnLabel(dimension) : undefined;
  const tooltipLabels = getTooltipLabels({ tooltipMetrics, tooltipColumns });

  const seriesMap = groupData(data, dimensionLabel);

  const seriesInCategoriesMap = new Map<
    DataRecordValue | undefined,
    Map<DataRecordValue | undefined, number>
  >();
  data.forEach(datum => {
    const category = datum[yAxisLabel];
    let dimensionValue: DataRecordValue | undefined;
    if (dimensionLabel) {
      if (legendState && !legendState[String(datum[dimensionLabel])]) {
        return;
      }
      if (subcategories) {
        dimensionValue = datum[dimensionLabel];
      }
    }
    const seriesMap = seriesInCategoriesMap.get(category);
    if (seriesMap) {
      const dimensionMapValue = seriesMap.get(dimensionValue);
      if (dimensionMapValue === undefined) {
        seriesMap.set(dimensionValue, seriesMap.size);
      }
    } else {
      seriesInCategoriesMap.set(category, new Map([[dimensionValue, 0]]));
    }
  });

  let seriesCount = 0;
  const categoryAndSeriesToIndexMap: typeof seriesInCategoriesMap = new Map();
  Array.from(seriesInCategoriesMap.entries()).forEach(([key, map]) => {
    categoryAndSeriesToIndexMap.set(
      key,
      new Map(
        Array.from(map.entries()).map(([key2, idx]) => [
          key2,
          seriesCount + idx,
        ]),
      ),
    );
    seriesCount += map.size;
  });

  const borderLines: { yAxis: number }[] = [];
  const categoryLines: { yAxis: number; name?: string }[] = [];
  let sum = 0;
  let prevSum = 0;
  Array.from(seriesInCategoriesMap.entries()).forEach(([key, map]) => {
    sum += map.size;
    categoryLines.push({
      yAxis: seriesCount - (sum + prevSum) / 2,
      name: key ? String(key) : undefined,
    });
    borderLines.push({ yAxis: seriesCount - sum });
    prevSum = sum;
  });

  const xAxisFormatter = getXAxisFormatter(xAxisTimeFormat);
  const tooltipTimeFormatter = getTooltipTimeFormatter(tooltipTimeFormat);
  const tooltipValuesFormatter = getNumberFormatter(tooltipValuesFormat);

  const bounds: [number | undefined, number | undefined] = [
    undefined,
    undefined,
  ];
  if (xAxisTimeBounds?.[0]) {
    const minDate = Math.min(
      ...data.map(datum => Number(datum[startTimeLabel] ?? 0)),
    );
    const time = dayjs(xAxisTimeBounds[0], 'HH:mm:ss');
    bounds[0] = +dayjs
      .utc(minDate)
      .hour(time.hour())
      .minute(time.minute())
      .second(time.second());
  }
  if (xAxisTimeBounds?.[1]) {
    const maxDate = Math.min(
      ...data.map(datum => Number(datum[endTimeLabel] ?? 0)),
    );
    const time = dayjs(xAxisTimeBounds[1], 'HH:mm:ss');
    bounds[1] = +dayjs
      .utc(maxDate)
      .hour(time.hour())
      .minute(time.minute())
      .second(time.second());
  }

  const padding = getPadding(
    showLegend && seriesMap.size > 1,
    legendOrientation,
    false,
    zoomable,
    legendMargin,
    !!xAxisTitle,
    'Left',
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );

  const colorScale = CategoricalColorNamespace.getScale(colorScheme as string);

  const getIndex = (datum: DataRecord) => {
    const seriesMap = categoryAndSeriesToIndexMap.get(datum[yAxisLabel]);
    const series =
      subcategories && dimensionLabel ? datum[dimensionLabel] : undefined;
    return seriesMap ? seriesMap.get(series) : undefined;
  };

  const series: (CustomSeriesOption | LineSeriesOption)[] = Array.from(
    seriesMap.entries(),
  )
    .map(([key, data], idx) => ({
      name: key as string | undefined,
      // For some reason items can visually disappear if progressive enabled.
      progressive: 0,
      itemStyle: {
        color: colorScale(String(key), sliceId ?? idx),
      },
      type: 'custom' as const,
      renderItem,
      data: data.map(datum => ({
        value: [
          datum[startTimeLabel],
          datum[endTimeLabel],
          getIndex(datum),
          seriesCount,
          ...Object.values(datum),
        ],
      })),
      dimensions: [...Object.values(Dimension), ...colnames],
      encode: {
        x: [0, 1],
      },
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  series.push(
    {
      animation: false,
      type: 'line' as const,
      markLine: {
        silent: true,
        symbol: ['none', 'none'],
        lineStyle: {
          type: 'dashed',
          // eslint-disable-next-line theme-colors/no-literal-colors
          color: '#dbe0ea',
        },
        label: {
          show: false,
        },
        data: borderLines,
      },
    },
    {
      animation: false,
      type: 'line',
      markLine: {
        silent: true,
        symbol: ['none', 'none'],
        lineStyle: {
          type: 'solid',
          // eslint-disable-next-line theme-colors/no-literal-colors
          color: '#00000000',
        },
        label: {
          show: true,
          position: 'start',
          formatter: '{b}',
          color: theme.colorText,
        },
        data: categoryLines,
      },
    },
  );

  const tooltipFormatterMap = {
    [GenericDataType.Numeric]: tooltipValuesFormatter,
    [GenericDataType.String]: undefined,
    [GenericDataType.Temporal]: tooltipTimeFormatter,
    [GenericDataType.Boolean]: undefined,
  };

  const echartOptions: EChartsCoreOption = {
    useUTC: true,
    tooltip: {
      formatter: (params: CallbackDataParams) =>
        tooltipHtml(
          tooltipLabels.map(label => {
            const offset = Object.keys(Dimension).length;
            const dimensionNames = params.dimensionNames!.slice(offset);
            const data = (params.value as any[]).slice(offset);

            const idx = dimensionNames.findIndex(v => v === label)!;
            const value = data[idx];
            const type = coltypes[idx];

            return [label, tooltipFormatterMap[type]?.(value) ?? value];
          }),
          dimensionLabel ? params.seriesName : undefined,
        ),
    },
    legend: {
      ...getLegendProps(
        legendType,
        legendOrientation,
        showLegend,
        theme,
        zoomable,
        legendState,
      ),
    },
    grid: {
      ...defaultGrid,
      ...padding,
    },
    dataZoom: zoomable && [
      {
        type: 'slider',
        filterMode: 'none',
        start: TIMESERIES_CONSTANTS.dataZoomStart,
        end: TIMESERIES_CONSTANTS.dataZoomEnd,
        bottom: TIMESERIES_CONSTANTS.zoomBottom,
      },
    ],
    toolbox: {
      show: zoomable,
      top: TIMESERIES_CONSTANTS.toolboxTop,
      right: TIMESERIES_CONSTANTS.toolboxRight,
      feature: {
        dataZoom: {
          yAxisIndex: false,
          title: {
            zoom: t('zoom area'),
            back: t('restore zoom'),
          },
        },
      },
    },
    series,
    xAxis: {
      name: xAxisTitle,
      nameLocation: 'middle',
      type: AxisType.Time,
      nameGap: convertInteger(xAxisTitleMargin),
      axisLabel: {
        formatter: xAxisFormatter,
        hideOverlap: true,
      },
      min: bounds[0],
      max: bounds[1],
    },
    yAxis: {
      name: yAxisTitle,
      nameGap: convertInteger(yAxisTitleMargin),
      nameLocation: 'middle',
      axisLabel: {
        show: false,
      },
      splitLine: {
        show: false,
      },
      type: AxisType.Value,
      min: 0,
      max: seriesCount,
    },
  };

  return {
    formData,
    queriesData,
    echartOptions,
    height,
    filterState,
    width,
    theme,
    hooks,
    emitCrossFilters,
    datasource,
    refs,
    setControlValue,
    onLegendStateChanged,
  };
}
