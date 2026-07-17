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
import { t } from '@apache-superset/core/translation';
import {
  CategoricalColorNamespace,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  getTimeFormatter,
  NumberFormats,
  ValueFormatter,
  getValueFormatter,
  tooltipHtml,
  DataRecord,
} from '@superset-ui/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import type { EChartsCoreOption } from 'echarts/core';
import type { PieSeriesOption } from 'echarts/charts';
import {
  DEFAULT_FORM_DATA as DEFAULT_PIE_FORM_DATA,
  EchartsPieChartProps,
  EchartsPieFormData,
  EchartsPieLabelType,
  PieChartDataItem,
  PieChartTransformedProps,
  TotalValuePaddingProps,
  PaddingResult,
  HalfDonut,
} from './types';
import { DEFAULT_LEGEND_FORM_DATA, OpacityEnum } from '../constants';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  sanitizeHtml,
} from '../utils/series';
import { resolveLegendLayout } from '../utils/legendLayout';
import { defaultGrid } from '../defaults';
import { convertInteger } from '../utils/convertInteger';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { getContributionLabel } from './utils';

const percentFormatter = getNumberFormatter(NumberFormats.PERCENT_2_POINT);

export function parseParams({
  params,
  numberFormatter,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent'>;
  numberFormatter: ValueFormatter;
  sanitizeName?: boolean;
}): string[] {
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);
  return [name, formattedValue, formattedPercent];
}

const HALF_DONUT_SWEEP_LIMIT = 180;

/**
 * Geometric configuration for each type of semi-circular layout.
 *
 * - `centerOffset` — offset of the chart center from the baseline 50% on the X and Y axes.
 *                    Resulting position: `50% + offset`.
 * - `totalBase`    — base position of the "Total" text as a percentage on the X and Y axes.
 *
 * The values ​​are selected so that the "Total" text visually remains
 * at the geometric center of the arc after the chart is re-centered.
 */

const HALF_DONUT_LAYOUT: Record<
  HalfDonut,
  {
    centerOffset: { x: number; y: number };
    totalBase: { left: number; top: number };
  }
> = {
  top: { centerOffset: { x: 0, y: 20 }, totalBase: { left: 50, top: 68.5 } },
  bottom: { centerOffset: { x: 0, y: -20 }, totalBase: { left: 50, top: 30 } },
  left: { centerOffset: { x: 5, y: 0 }, totalBase: { left: 55, top: 50 } },
  right: { centerOffset: { x: -5, y: 0 }, totalBase: { left: 30, top: 50 } },
  none: { centerOffset: { x: 0, y: 0 }, totalBase: { left: 50, top: 50 } },
};

/**
 * Determines the type of semicircular layout based on the start angle and swept angle.
 *
 * All four semicircle orientations are supported:
 * - `'top'`    — arc at the top, center shifted down (center Y = 70%).
 * - `'bottom'` — arc at the bottom, center shifted up (center Y = 30%).
 * - `'left'`   — arc on the left, center shifted right (center X = 70%).
 * - `'right'`  — arc on the right, center shifted left (center X = 30%).
 *
 * @param startAngle - The start angle of the arc in degrees (0–360).
 * @param sweptAngle - The swept angle of the arc in degrees (0–360).
 * @returns The type of semicircular layout.
 */

export const getHalfDonut = (
  startAngle: number,
  sweptAngle: number,
): HalfDonut => {
  if (sweptAngle > HALF_DONUT_SWEEP_LIMIT) return 'none';

  const normalized = startAngle % 360;

  if (normalized === 180) return 'top';
  if (normalized === 0) return 'bottom';
  if (normalized === 270) return 'left';
  if (normalized === 90) return 'right';

  return 'none';
};

const getHalfDonutLayout = (startAngle: number, sweptAngle: number) =>
  HALF_DONUT_LAYOUT[getHalfDonut(startAngle, sweptAngle)];

export function getTotalValuePadding({
  chartPadding,
  donut,
  width,
  height,
  startAngle,
  sweptAngle,
}: TotalValuePaddingProps): PaddingResult {
  const safeHeight = height || 1;
  const safeWidth = width || 1;

  const halfType = getHalfDonut(startAngle, sweptAngle);
  const layout = HALF_DONUT_LAYOUT[halfType];
  const isHalf = halfType !== 'none';

  const calculateTop = (): string => {
    if (chartPadding.bottom) {
      return donut
        ? `${layout.totalBase.top - (chartPadding.bottom / safeHeight) * 50}%`
        : '0';
    }

    if (chartPadding.top || isHalf) {
      if (donut) {
        return `${layout.totalBase.top + (chartPadding.top / safeHeight) * 50}%`;
      }
      return `${(chartPadding.top / safeHeight) * 100}%`;
    }

    return donut ? 'middle' : '0';
  };

  const calculateLeft = (): string => {
    if (chartPadding.right) {
      const rightPercent = (chartPadding.right / safeWidth) * 100;
      return `${layout.totalBase.left - rightPercent * 0.75}%`;
    }

    if (chartPadding.left) {
      const leftPercent = (chartPadding.left / safeWidth) * 100;
      return `${layout.totalBase.left + leftPercent * 0.25}%`;
    }

    if (isHalf && (halfType === 'left' || halfType === 'right')) {
      return `${layout.totalBase.left}%`;
    }

    return 'center';
  };

  return {
    top: calculateTop(),
    left: calculateLeft(),
  };
}

export default function transformProps(
  chartProps: EchartsPieChartProps,
): PieChartTransformedProps {
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
    datasource,
  } = chartProps;
  const {
    columnFormats = {},
    currencyFormats = {},
    currencyCodeColumn,
  } = datasource;
  const { data: rawData = [], detected_currency: detectedCurrency } =
    queriesData[0];
  const coltypeMapping = getColtypesMapping(queriesData[0]);

  const {
    colorScheme,
    donut,
    groupby,
    innerRadius,
    labelsOutside,
    labelLine,
    labelType,
    labelTemplate,
    legendMargin,
    legendOrientation,
    legendType,
    legendSort,
    metric = '',
    numberFormat,
    currencyFormat,
    dateFormat,
    outerRadius,
    showLabels,
    showLegend,
    showLabelsThreshold,
    startAngle,
    sweptAngle,
    sliceId,
    showTotal,
    roseType,
    thresholdForOther,
  }: EchartsPieFormData = {
    ...DEFAULT_LEGEND_FORM_DATA,
    ...DEFAULT_PIE_FORM_DATA,
    ...formData,
  };
  const refs: Refs = {};
  const metricLabel = getMetricLabel(metric);
  const contributionLabel = getContributionLabel(metricLabel);
  const groupbyLabels = groupby.map(getColumnLabel);
  const minShowLabelAngle = (showLabelsThreshold || 0) * 3.6;

  const numberFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    numberFormat,
    currencyFormat,
    undefined,
    rawData,
    currencyCodeColumn,
    detectedCurrency,
  );

  let data = rawData;
  const otherRows: DataRecord[] = [];
  const otherTooltipData: string[][] = [];
  let otherDatum: PieChartDataItem | null = null;
  let otherSum = 0;
  if (thresholdForOther) {
    let contributionSum = 0;
    data = data.filter(datum => {
      const contribution = datum[contributionLabel] as number;
      if (!contribution || contribution * 100 >= thresholdForOther) {
        return true;
      }
      otherSum += datum[metricLabel] as number;
      contributionSum += contribution;
      otherRows.push(datum);
      otherTooltipData.push([
        extractGroupbyLabel({
          datum,
          groupby: groupbyLabels,
          coltypeMapping,
          timeFormatter: getTimeFormatter(dateFormat),
        }),
        numberFormatter(datum[metricLabel] as number),
        percentFormatter(contribution),
      ]);
      return false;
    });
    const otherName = t('Other');
    otherTooltipData.push([
      t('Total'),
      numberFormatter(otherSum),
      percentFormatter(contributionSum),
    ]);
    if (otherSum) {
      otherDatum = {
        name: otherName,
        value: otherSum,
        itemStyle: {
          color: theme.colorText,
          opacity:
            filterState.selectedValues &&
            !filterState.selectedValues.includes(otherName)
              ? OpacityEnum.SemiTransparent
              : OpacityEnum.NonTransparent,
        },
        isOther: true,
      };
    }
  }

  const labelMap = data.reduce((acc: Record<string, string[]>, datum) => {
    const label = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat),
    });
    return {
      ...acc,
      [label]: groupbyLabels.map(col => datum[col] as string),
    };
  }, {});

  const { setDataMask = () => {}, onContextMenu } = hooks;
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  let totalValue = 0;

  const transformedData: PieSeriesOption[] = data.map(datum => {
    const name = extractGroupbyLabel({
      datum,
      groupby: groupbyLabels,
      coltypeMapping,
      timeFormatter: getTimeFormatter(dateFormat),
    });

    const isFiltered =
      filterState.selectedValues && !filterState.selectedValues.includes(name);
    const value = datum[metricLabel];

    if (typeof value === 'number' || typeof value === 'string') {
      totalValue += convertInteger(value);
    }

    return {
      value,
      name,
      itemStyle: {
        color: colorFn(name, sliceId),
        opacity: isFiltered
          ? OpacityEnum.SemiTransparent
          : OpacityEnum.NonTransparent,
      },
    };
  });
  if (otherDatum) {
    transformedData.push(otherDatum);
    totalValue += otherSum;
  }

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

  const formatTemplate = (
    template: string,
    formattedParams: {
      name: string;
      value: string;
      percent: string;
    },
    rawParams: CallbackDataParams,
  ) => {
    // This function supports two forms of template variables:
    // 1. {name}, {value}, {percent}, for values formatted by number formatter.
    // 2. {a}, {b}, {c}, {d}, compatible with ECharts formatter.
    //
    // \n is supported to represent a new line.

    const items = {
      '{name}': formattedParams.name,
      '{value}': formattedParams.value,
      '{percent}': formattedParams.percent,
      '{a}': rawParams.seriesName || '',
      '{b}': rawParams.name,
      '{c}': `${rawParams.value}`,
      '{d}': `${rawParams.percent}`,
      '\\n': '\n',
    };

    return Object.entries(items).reduce(
      (acc, [key, value]) => acc.replaceAll(key, value),
      template,
    );
  };

  const formatter = (params: CallbackDataParams) => {
    const [name, formattedValue, formattedPercent] = parseParams({
      params,
      numberFormatter,
    });
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
      case EchartsPieLabelType.ValuePercent:
        return `${formattedValue} (${formattedPercent})`;
      case EchartsPieLabelType.Template:
        if (!labelTemplate) {
          return '';
        }
        return formatTemplate(
          labelTemplate,
          {
            name,
            value: formattedValue,
            percent: formattedPercent,
          },
          params,
        );
      default:
        return name;
    }
  };

  const defaultLabel = {
    formatter,
    show: showLabels,
    color: theme.colorText,
  };
  const legendData = transformedData
    .map(datum => datum.name)
    .sort((a: string, b: string) => {
      if (!legendSort) return 0;
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

  const chartPadding = getChartPadding(
    showLegend,
    legendOrientation,
    effectiveLegendMargin,
  );

  const series: PieSeriesOption[] = [
    {
      type: 'pie',
      ...chartPadding,
      animation: false,
      roseType: roseType || undefined,
      radius: [`${donut ? innerRadius : 0}%`, `${outerRadius}%`],
      center: [
        `${50 + getHalfDonutLayout(startAngle, sweptAngle).centerOffset.x}%`,
        `${50 + getHalfDonutLayout(startAngle, sweptAngle).centerOffset.y}%`,
      ],
      startAngle,
      endAngle: startAngle - sweptAngle,
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
          backgroundColor: theme.colorBgContainer,
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
      formatter: (params: any) => {
        const [name, formattedValue, formattedPercent] = parseParams({
          params,
          numberFormatter,
          sanitizeName: true,
        });
        if (params?.data?.isOther) {
          return tooltipHtml(otherTooltipData, name);
        }
        return tooltipHtml(
          [[metricLabel, formattedValue, formattedPercent]],
          name,
        );
      },
    },
    legend: {
      ...getLegendProps(
        effectiveLegendType,
        legendOrientation,
        showLegend,
        theme,
      ),
      data: legendData,
    },
    graphic: showTotal
      ? {
          type: 'text',
          ...getTotalValuePadding({
            chartPadding,
            donut,
            width,
            height,
            startAngle,
            sweptAngle,
          }),
          style: {
            text: t('Total: %s', numberFormatter(totalValue)),
            fontSize: 16,
            fontWeight: 'bold',
            fill: theme.colorText,
          },
          z: 10,
        }
      : null,
    series,
  };

  return {
    formData,
    width,
    height,
    echartOptions,
    setDataMask,
    labelMap,
    groupby,
    selectedValues,
    onContextMenu,
    refs,
    emitCrossFilters,
    coltypeMapping,
  };
}
