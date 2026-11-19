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
} from './types';
import { DEFAULT_LEGEND_FORM_DATA, OpacityEnum } from '../constants';
import {
  extractGroupbyLabel,
  getChartPadding,
  getColtypesMapping,
  getLegendProps,
  getLegendScrollDataIndex,
  getLegendTextWidthBudget,
  measureTextWidth,
  sanitizeHtml,
} from '../utils/series';
import { resolveLegendLayout } from '../utils/legendLayout';
import { defaultGrid } from '../defaults';
import { convertInteger } from '../utils/convertInteger';
import { getDefaultTooltip } from '../utils/tooltip';
import { LegendOrientation, Refs } from '../types';
import { getContributionLabel } from './utils';
import { applyLabelOverflow } from './labelOverflow';

// Upper bound for a single legend item's text, so one long name can't take a
// whole legend row.
const MAX_LEGEND_TEXT_WIDTH = 250;

const defaultPercentFormatter = getNumberFormatter(
  NumberFormats.PERCENT_2_POINT,
);

export function parseParams({
  params,
  numberFormatter,
  percentFormatter = defaultPercentFormatter,
  sanitizeName = false,
}: {
  params: Pick<CallbackDataParams, 'name' | 'value' | 'percent'>;
  numberFormatter: ValueFormatter;
  percentFormatter?: ValueFormatter;
  sanitizeName?: boolean;
}): string[] {
  const { name: rawName = '', value, percent } = params;
  const name = sanitizeName ? sanitizeHtml(rawName) : rawName;
  const formattedValue = numberFormatter(value as number);
  const formattedPercent = percentFormatter((percent as number) / 100);
  return [name, formattedValue, formattedPercent];
}

/**
 * Bounding box of the pie arc in unit coordinates: outer radius = 1,
 * mathematical y-up convention matching ECharts' angle convention
 * (0° points right, 90° points up, angles sweep clockwise from
 * `startAngle` to `startAngle - sweptAngle`).
 */
export interface ArcBoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Computes the bounding box of an annular sector from its angles.
 *
 * The box is spanned by the outer arc endpoints, the inner arc endpoints
 * (which collapse to the pie origin when `innerRatio` is 0), and every axis
 * extreme (0°/90°/180°/270°) the arc sweeps through.
 *
 * @param startAngle - The start angle of the arc in degrees.
 * @param sweptAngle - The total angle covered by the arc in degrees.
 * @param innerRatio - Inner radius as a fraction of the outer radius (0–1).
 */
export function getArcBoundingBox(
  startAngle: number,
  sweptAngle: number,
  innerRatio: number,
): ArcBoundingBox {
  if (sweptAngle >= 360) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const endAngle = startAngle - sweptAngle;
  const points: [number, number][] = [];
  [startAngle, endAngle].forEach(angle => {
    const x = Math.cos(toRad(angle));
    const y = Math.sin(toRad(angle));
    points.push([x, y], [innerRatio * x, innerRatio * y]);
  });
  for (
    let axis = Math.ceil(endAngle / 90) * 90;
    axis <= startAngle;
    axis += 90
  ) {
    points.push([Math.cos(toRad(axis)), Math.sin(toRad(axis))]);
  }
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Arcs covering only a sliver of the circle would otherwise scale up without
 * bound; cap the fit scale at the factor a quarter arc reaches naturally.
 */
const MAX_RADIUS_SCALE = 2;

export interface PieLayout {
  /** Pie origin in px, relative to the padded series rect. */
  center: [number, number];
  /** Inner/outer radius percent strings, scaled to fit the arc's box. */
  radius: [string, string];
  /** Pie origin in px, in container coordinates (for the graphic component). */
  totalAnchor: { x: number; y: number };
}

/**
 * Lays out the pie geometrically for any start/sweep angle combination:
 * scales the radius until the arc's bounding box fills the available rect
 * (so partial arcs reclaim the space a full circle would leave empty) and
 * shifts the pie origin so that box is centered. A full circle reproduces
 * ECharts' default layout exactly.
 */
export function getPieLayout({
  width,
  height,
  padding,
  startAngle,
  sweptAngle,
  donut,
  innerRadius,
  outerRadius,
}: {
  width: number;
  height: number;
  padding: { top: number; bottom: number; left: number; right: number };
  startAngle: number;
  sweptAngle: number;
  donut: boolean;
  innerRadius: number;
  outerRadius: number;
}): PieLayout {
  const rectWidth = Math.max(width - padding.left - padding.right, 1);
  const rectHeight = Math.max(height - padding.top - padding.bottom, 1);
  const innerRatio = donut ? innerRadius / Math.max(outerRadius, 1) : 0;
  const box = getArcBoundingBox(startAngle, sweptAngle, innerRatio);
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;

  // ECharts resolves percentage radii against min(rect width, height) / 2.
  // Grow that basis until the arc's bounding box hits the rect on one axis.
  const fullBasis = Math.min(rectWidth, rectHeight) / 2;
  const fitBasis = Math.min(rectWidth / boxWidth, rectHeight / boxHeight);
  const scale = Math.min(fitBasis / fullBasis, MAX_RADIUS_SCALE);
  const outerPx = (outerRadius / 100) * fullBasis * scale;

  // Place the pie origin so the arc's box is centered in the rect. Unit y
  // points up while screen y points down, hence the sign flip.
  const round = (value: number) => Math.round(value * 100) / 100;
  const centerX = rectWidth / 2 - ((box.minX + box.maxX) / 2) * outerPx;
  const centerY = rectHeight / 2 + ((box.minY + box.maxY) / 2) * outerPx;

  // The pie origin is the natural spot for the "Total" text (the middle of
  // the hole, or the flat edge of a half donut), but for narrow arcs it can
  // fall far outside the drawn shape, even off-canvas. Clamp it into the
  // arc's bounding box, which always sits within the rect.
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);
  const halfBoxWidth = (boxWidth / 2) * outerPx;
  const halfBoxHeight = (boxHeight / 2) * outerPx;
  const anchorX = clamp(
    centerX,
    rectWidth / 2 - halfBoxWidth,
    rectWidth / 2 + halfBoxWidth,
  );
  const anchorY = clamp(
    centerY,
    rectHeight / 2 - halfBoxHeight,
    rectHeight / 2 + halfBoxHeight,
  );

  return {
    center: [round(centerX), round(centerY)],
    radius: [
      `${round(donut ? innerRadius * scale : 0)}%`,
      `${round(outerRadius * scale)}%`,
    ],
    totalAnchor: {
      x: round(padding.left + anchorX),
      y: round(padding.top + anchorY),
    },
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
    legendState,
    legendIndex,
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
    labelMaxWidth,
    labelOverflow,
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
    showSelectorLegend,
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
  const percentFormatter = numberFormat?.endsWith('%')
    ? getNumberFormatter(numberFormat)
    : defaultPercentFormatter;

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

  const {
    setDataMask = () => {},
    onContextMenu,
    onLegendStateChanged,
    onLegendScroll,
  } = hooks;
  const colorFn =
    chartProps.colorScale ??
    CategoricalColorNamespace.getScale(colorScheme as string);

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

  const measureLabelText = (text: string) => measureTextWidth(text, theme);

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

  const formatLabel = (params: CallbackDataParams): string => {
    const [name, formattedValue, formattedPercent] = parseParams({
      params,
      numberFormatter,
      percentFormatter,
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

  // Labels are shortened here rather than through ECharts' `label.width`, as
  // setting a width disables ECharts' own viewport-aware limit for outside
  // labels, which keeps them on-canvas when the chart is narrow.
  const formatter = (params: CallbackDataParams) =>
    applyLabelOverflow(formatLabel(params), {
      maxWidth: Number(labelMaxWidth) || 0,
      overflow: labelOverflow,
      measure: measureLabelText,
    });

  const defaultLabel = {
    formatter,
    show: showLabels,
    color: theme.colorText,
    // Render at the size the overflow handling measures text with.
    ...(Number(labelMaxWidth) > 0 ? { fontSize: theme.fontSizeSM } : {}),
  };
  const legendData = transformedData
    .map(datum => datum.name)
    .sort((a: string, b: string) => {
      if (!legendSort) return 0;
      return legendSort === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    });
  // Pie category names can be arbitrarily long, so legend items are truncated
  // to a width that leaves room for the icon, pager and selector buttons, and
  // the full name is shown in a tooltip on hover.
  const isVerticalLegend =
    legendOrientation === LegendOrientation.Left ||
    legendOrientation === LegendOrientation.Right;
  const legendTextWidth = isVerticalLegend
    ? MAX_LEGEND_TEXT_WIDTH
    : getLegendTextWidthBudget({
        chartWidth: width,
        maxWidth: MAX_LEGEND_TEXT_WIDTH,
        showSelectors: showSelectorLegend !== false,
        type: legendType,
      });
  const { effectiveLegendMargin, effectiveLegendType } = resolveLegendLayout({
    chartHeight: height,
    chartWidth: width,
    legendItems: legendData,
    legendMargin,
    maxLabelWidth: legendTextWidth,
    orientation: legendOrientation,
    show: showLegend,
    showSelectors: showSelectorLegend !== false,
    theme,
    type: legendType,
  });

  const chartPadding = getChartPadding(
    showLegend,
    legendOrientation,
    effectiveLegendMargin,
  );

  const pieLayout = getPieLayout({
    width,
    height,
    padding: chartPadding,
    startAngle,
    sweptAngle,
    donut,
    innerRadius,
    outerRadius,
  });

  const series: PieSeriesOption[] = [
    {
      type: 'pie',
      ...chartPadding,
      animation: false,
      roseType: roseType || undefined,
      radius: pieLayout.radius,
      center: pieLayout.center,
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
          percentFormatter,
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
        showSelectorLegend,
        false,
        legendState,
        // Left/Right legends are also limited to the margin reserved for them.
        isVerticalLegend ? chartPadding : undefined,
        legendTextWidth,
      ),
      scrollDataIndex: getLegendScrollDataIndex(legendIndex, legendData.length),
      data: legendData,
    },
    graphic: showTotal
      ? {
          type: 'text',
          // Donut: center the text on the pie origin (the middle of the
          // hole, or the flat edge of a partial arc). Pie: park it at the
          // top center of the padded rect so it doesn't overlap the slices.
          x: donut
            ? pieLayout.totalAnchor.x
            : chartPadding.left +
              (width - chartPadding.left - chartPadding.right) / 2,
          y: donut ? pieLayout.totalAnchor.y : chartPadding.top,
          style: {
            text: t('Total: %s', numberFormatter(totalValue)),
            align: 'center',
            verticalAlign: donut ? 'middle' : 'top',
            fontSize: 16,
            fontWeight: 'bold',
            fill: theme.colorText,
          },
          z: 10,
        }
      : null,
    series,
    // Truncated legend names are otherwise only recoverable by hovering, so
    // expose the full slice names to assistive technology via ECharts' ARIA
    // description of the chart.
    ...(showLegend
      ? {
          aria: {
            enabled: true,
            label: { data: { maxCount: legendData.length } },
          },
        }
      : {}),
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
    onLegendStateChanged,
    onLegendScroll,
    refs,
    emitCrossFilters,
    coltypeMapping,
  };
}
