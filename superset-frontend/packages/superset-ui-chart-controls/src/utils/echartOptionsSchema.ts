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

/**
 * Unified ECharts Options Schema
 *
 * This file serves as the single source of truth for:
 * 1. Runtime validation (Zod schema)
 * 2. TypeScript types (inferred from Zod)
 *
 * Reference: https://echarts.apache.org/en/option.html
 */

import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

/** Color value - hex, rgb, rgba, or named color */
const colorSchema = z.string();

/** Numeric or percentage string (e.g., '50%') */
const numberOrPercentSchema = z.union([z.number(), z.string()]);

/** Line type */
const lineTypeSchema = z.union([
  z.enum(['solid', 'dashed', 'dotted']),
  z.array(z.number()),
]);

/** Font weight */
const fontWeightSchema = z.union([
  z.enum(['normal', 'bold', 'bolder', 'lighter']),
  z.number().min(100).max(900),
]);

/** Font style */
const fontStyleSchema = z.enum(['normal', 'italic', 'oblique']);

/** Symbol type */
const symbolTypeSchema = z.string();

// =============================================================================
// Text Style Schema
// =============================================================================

export const textStyleSchema = z.object({
    color: colorSchema.optional(),
    fontStyle: fontStyleSchema.optional(),
    fontWeight: fontWeightSchema.optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    backgroundColor: z
      .union([colorSchema, z.literal('transparent')])
      .optional(),
    borderColor: colorSchema.optional(),
    borderWidth: z.number().optional(),
    borderType: lineTypeSchema.optional(),
    borderRadius: z.union([z.number(), z.array(z.number())]).optional(),
    padding: z.union([z.number(), z.array(z.number())]).optional(),
    shadowColor: colorSchema.optional(),
    shadowBlur: z.number().optional(),
    shadowOffsetX: z.number().optional(),
    shadowOffsetY: z.number().optional(),
    width: numberOrPercentSchema.optional(),
    height: numberOrPercentSchema.optional(),
    textBorderColor: colorSchema.optional(),
    textBorderWidth: z.number().optional(),
    textShadowColor: colorSchema.optional(),
    textShadowBlur: z.number().optional(),
    textShadowOffsetX: z.number().optional(),
    textShadowOffsetY: z.number().optional(),
    overflow: z.enum(['none', 'truncate', 'break', 'breakAll']).optional(),
    ellipsis: z.string().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  }).catchall(z.unknown());

// =============================================================================
// Style Schemas
// =============================================================================

export const lineStyleSchema = z.object({
    color: colorSchema.optional(),
    width: z.number().optional(),
    type: lineTypeSchema.optional(),
    dashOffset: z.number().optional(),
    cap: z.enum(['butt', 'round', 'square']).optional(),
    join: z.enum(['bevel', 'round', 'miter']).optional(),
    miterLimit: z.number().optional(),
    shadowBlur: z.number().optional(),
    shadowColor: colorSchema.optional(),
    shadowOffsetX: z.number().optional(),
    shadowOffsetY: z.number().optional(),
    opacity: z.number().min(0).max(1).optional(),
  });

export const areaStyleSchema = z.object({
    color: z.union([colorSchema, z.array(colorSchema)]).optional(),
    origin: z.union([z.enum(['auto', 'start', 'end']), z.number()]).optional(),
    shadowBlur: z.number().optional(),
    shadowColor: colorSchema.optional(),
    shadowOffsetX: z.number().optional(),
    shadowOffsetY: z.number().optional(),
    opacity: z.number().min(0).max(1).optional(),
  });

export const itemStyleSchema = z.object({
    color: colorSchema.optional(),
    borderColor: colorSchema.optional(),
    borderWidth: z.number().optional(),
    borderType: lineTypeSchema.optional(),
    borderRadius: z.union([z.number(), z.array(z.number())]).optional(),
    shadowBlur: z.number().optional(),
    shadowColor: colorSchema.optional(),
    shadowOffsetX: z.number().optional(),
    shadowOffsetY: z.number().optional(),
    opacity: z.number().min(0).max(1).optional(),
  });

// =============================================================================
// Label Schema
// =============================================================================

export const labelSchema = z.object({
    show: z.boolean().optional(),
    position: z
      .enum([
        'top',
        'left',
        'right',
        'bottom',
        'inside',
        'insideLeft',
        'insideRight',
        'insideTop',
        'insideBottom',
        'insideTopLeft',
        'insideBottomLeft',
        'insideTopRight',
        'insideBottomRight',
        'outside',
      ])
      .optional(),
    distance: z.number().optional(),
    rotate: z.number().optional(),
    offset: z.array(z.number()).optional(),
    formatter: z.string().optional(), // Only string formatters allowed, not functions
    color: colorSchema.optional(),
    fontStyle: fontStyleSchema.optional(),
    fontWeight: fontWeightSchema.optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
  });

// =============================================================================
// Title Schema
// =============================================================================

export const titleSchema = z.object({
  id: z.string().optional(),
  show: z.boolean().optional(),
  text: z.string().optional(),
  link: z.string().optional(),
  target: z.enum(['self', 'blank']).optional(),
  textStyle: textStyleSchema.optional(),
  subtext: z.string().optional(),
  sublink: z.string().optional(),
  subtarget: z.enum(['self', 'blank']).optional(),
  subtextStyle: textStyleSchema.optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  textVerticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  triggerEvent: z.boolean().optional(),
  padding: z.union([z.number(), z.array(z.number())]).optional(),
  itemGap: z.number().optional(),
  zlevel: z.number().optional(),
  z: z.number().optional(),
  left: numberOrPercentSchema.optional(),
  top: numberOrPercentSchema.optional(),
  right: numberOrPercentSchema.optional(),
  bottom: numberOrPercentSchema.optional(),
  backgroundColor: colorSchema.optional(),
  borderColor: colorSchema.optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.union([z.number(), z.array(z.number())]).optional(),
  shadowBlur: z.number().optional(),
  shadowColor: colorSchema.optional(),
  shadowOffsetX: z.number().optional(),
  shadowOffsetY: z.number().optional(),
});

// =============================================================================
// Legend Schema
// =============================================================================

export const legendSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['plain', 'scroll']).optional(),
  show: z.boolean().optional(),
  zlevel: z.number().optional(),
  z: z.number().optional(),
  left: numberOrPercentSchema.optional(),
  top: numberOrPercentSchema.optional(),
  right: numberOrPercentSchema.optional(),
  bottom: numberOrPercentSchema.optional(),
  width: numberOrPercentSchema.optional(),
  height: numberOrPercentSchema.optional(),
  orient: z.enum(['horizontal', 'vertical']).optional(),
  align: z.enum(['auto', 'left', 'right']).optional(),
  padding: z.union([z.number(), z.array(z.number())]).optional(),
  itemGap: z.number().optional(),
  itemWidth: z.number().optional(),
  itemHeight: z.number().optional(),
  itemStyle: itemStyleSchema.optional(),
  lineStyle: lineStyleSchema.optional(),
  textStyle: textStyleSchema.optional(),
  icon: symbolTypeSchema.optional(),
  selectedMode: z
    .union([z.boolean(), z.enum(['single', 'multiple', 'series'])])
    .optional(),
  inactiveColor: colorSchema.optional(),
  inactiveBorderColor: colorSchema.optional(),
  inactiveBorderWidth: z.number().optional(),
  backgroundColor: colorSchema.optional(),
  borderColor: colorSchema.optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.union([z.number(), z.array(z.number())]).optional(),
  shadowBlur: z.number().optional(),
  shadowColor: colorSchema.optional(),
  shadowOffsetX: z.number().optional(),
  shadowOffsetY: z.number().optional(),
  pageButtonItemGap: z.number().optional(),
  pageButtonGap: z.number().optional(),
  pageButtonPosition: z.enum(['start', 'end']).optional(),
  pageIconColor: colorSchema.optional(),
  pageIconInactiveColor: colorSchema.optional(),
  pageIconSize: z.union([z.number(), z.array(z.number())]).optional(),
  pageTextStyle: textStyleSchema.optional(),
});

// =============================================================================
// Grid Schema
// =============================================================================

export const gridSchema = z.object({
  id: z.string().optional(),
  show: z.boolean().optional(),
  zlevel: z.number().optional(),
  z: z.number().optional(),
  left: numberOrPercentSchema.optional(),
  top: numberOrPercentSchema.optional(),
  right: numberOrPercentSchema.optional(),
  bottom: numberOrPercentSchema.optional(),
  width: numberOrPercentSchema.optional(),
  height: numberOrPercentSchema.optional(),
  containLabel: z.boolean().optional(),
  backgroundColor: colorSchema.optional(),
  borderColor: colorSchema.optional(),
  borderWidth: z.number().optional(),
  shadowBlur: z.number().optional(),
  shadowColor: colorSchema.optional(),
  shadowOffsetX: z.number().optional(),
  shadowOffsetY: z.number().optional(),
});

// =============================================================================
// Axis Schemas
// =============================================================================

const axisLineSchema = z.object({
    show: z.boolean().optional(),
    onZero: z.boolean().optional(),
    onZeroAxisIndex: z.number().optional(),
    symbol: z.union([z.string(), z.array(z.string())]).optional(),
    symbolSize: z.array(z.number()).optional(),
    symbolOffset: z.union([z.number(), z.array(z.number())]).optional(),
    lineStyle: lineStyleSchema.optional(),
  });

const axisTickSchema = z.object({
    show: z.boolean().optional(),
    alignWithLabel: z.boolean().optional(),
    interval: z.union([z.number(), z.literal('auto')]).optional(),
    inside: z.boolean().optional(),
    length: z.number().optional(),
    lineStyle: lineStyleSchema.optional(),
  });

const axisLabelSchema = z.object({
    show: z.boolean().optional(),
    interval: z.union([z.number(), z.literal('auto')]).optional(),
    inside: z.boolean().optional(),
    rotate: z.number().optional(),
    margin: z.number().optional(),
    formatter: z.string().optional(), // Only string formatters
    showMinLabel: z.boolean().optional(),
    showMaxLabel: z.boolean().optional(),
    hideOverlap: z.boolean().optional(),
    color: colorSchema.optional(),
    fontStyle: fontStyleSchema.optional(),
    fontWeight: fontWeightSchema.optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
  });

const splitLineSchema = z.object({
    show: z.boolean().optional(),
    interval: z.union([z.number(), z.literal('auto')]).optional(),
    lineStyle: lineStyleSchema.optional(),
  });

const splitAreaSchema = z.object({
    show: z.boolean().optional(),
    interval: z.union([z.number(), z.literal('auto')]).optional(),
    areaStyle: areaStyleSchema.optional(),
  });

export const axisSchema = z.object({
    id: z.string().optional(),
    show: z.boolean().optional(),
    gridIndex: z.number().optional(),
    alignTicks: z.boolean().optional(),
    position: z.enum(['top', 'bottom', 'left', 'right']).optional(),
    offset: z.number().optional(),
    type: z.enum(['value', 'category', 'time', 'log']).optional(),
    name: z.string().optional(),
    nameLocation: z.enum(['start', 'middle', 'center', 'end']).optional(),
    nameTextStyle: textStyleSchema.optional(),
    nameGap: z.number().optional(),
    nameRotate: z.number().optional(),
    inverse: z.boolean().optional(),
    boundaryGap: z
      .union([z.boolean(), z.array(z.union([z.string(), z.number()]))])
      .optional(),
    min: z.union([z.number(), z.string(), z.literal('dataMin')]).optional(),
    max: z.union([z.number(), z.string(), z.literal('dataMax')]).optional(),
    scale: z.boolean().optional(),
    splitNumber: z.number().optional(),
    minInterval: z.number().optional(),
    maxInterval: z.number().optional(),
    interval: z.number().optional(),
    logBase: z.number().optional(),
    silent: z.boolean().optional(),
    triggerEvent: z.boolean().optional(),
    axisLine: axisLineSchema.optional(),
    axisTick: axisTickSchema.optional(),
    minorTick: axisTickSchema.optional(),
    axisLabel: axisLabelSchema.optional(),
    splitLine: splitLineSchema.optional(),
    minorSplitLine: splitLineSchema.optional(),
    splitArea: splitAreaSchema.optional(),
    zlevel: z.number().optional(),
    z: z.number().optional(),
  });

// =============================================================================
// Tooltip Schema
// =============================================================================

export const tooltipSchema = z.object({
  show: z.boolean().optional(),
  trigger: z.enum(['item', 'axis', 'none']).optional(),
  triggerOn: z
    .enum(['mousemove', 'click', 'mousemove|click', 'none'])
    .optional(),
  alwaysShowContent: z.boolean().optional(),
  showDelay: z.number().optional(),
  hideDelay: z.number().optional(),
  enterable: z.boolean().optional(),
  renderMode: z.enum(['html', 'richText']).optional(),
  confine: z.boolean().optional(),
  appendToBody: z.boolean().optional(),
  transitionDuration: z.number().optional(),
  position: z
    .union([
      z.enum(['inside', 'top', 'left', 'right', 'bottom']),
      z.array(z.union([z.number(), z.string()])),
    ])
    .optional(),
  formatter: z.string().optional(), // Only string formatters
  padding: z.union([z.number(), z.array(z.number())]).optional(),
  backgroundColor: colorSchema.optional(),
  borderColor: colorSchema.optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  shadowBlur: z.number().optional(),
  shadowColor: colorSchema.optional(),
  shadowOffsetX: z.number().optional(),
  shadowOffsetY: z.number().optional(),
  textStyle: textStyleSchema.optional(),
  extraCssText: z.string().optional(),
  order: z
    .enum(['seriesAsc', 'seriesDesc', 'valueAsc', 'valueDesc'])
    .optional(),
});

// =============================================================================
// DataZoom Schema
// =============================================================================

export const dataZoomSchema = z.object({
    type: z.enum(['slider', 'inside']).optional(),
    id: z.string().optional(),
    show: z.boolean().optional(),
    disabled: z.boolean().optional(),
    xAxisIndex: z.union([z.number(), z.array(z.number())]).optional(),
    yAxisIndex: z.union([z.number(), z.array(z.number())]).optional(),
    filterMode: z.enum(['filter', 'weakFilter', 'empty', 'none']).optional(),
    start: z.number().optional(),
    end: z.number().optional(),
    startValue: z.union([z.number(), z.string()]).optional(),
    endValue: z.union([z.number(), z.string()]).optional(),
    minSpan: z.number().optional(),
    maxSpan: z.number().optional(),
    minValueSpan: z.union([z.number(), z.string()]).optional(),
    maxValueSpan: z.union([z.number(), z.string()]).optional(),
    orient: z.enum(['horizontal', 'vertical']).optional(),
    zoomLock: z.boolean().optional(),
    throttle: z.number().optional(),
    rangeMode: z.array(z.enum(['value', 'percent'])).optional(),
    zlevel: z.number().optional(),
    z: z.number().optional(),
    left: numberOrPercentSchema.optional(),
    top: numberOrPercentSchema.optional(),
    right: numberOrPercentSchema.optional(),
    bottom: numberOrPercentSchema.optional(),
    width: numberOrPercentSchema.optional(),
    height: numberOrPercentSchema.optional(),
    backgroundColor: colorSchema.optional(),
    borderColor: colorSchema.optional(),
    borderRadius: z.number().optional(),
    fillerColor: colorSchema.optional(),
    handleSize: numberOrPercentSchema.optional(),
    handleStyle: itemStyleSchema.optional(),
    moveHandleSize: z.number().optional(),
    moveHandleStyle: itemStyleSchema.optional(),
    labelPrecision: z.union([z.number(), z.literal('auto')]).optional(),
    textStyle: textStyleSchema.optional(),
    realtime: z.boolean().optional(),
    showDetail: z.boolean().optional(),
    showDataShadow: z.union([z.boolean(), z.literal('auto')]).optional(),
    zoomOnMouseWheel: z
      .union([z.boolean(), z.enum(['shift', 'ctrl', 'alt'])])
      .optional(),
    moveOnMouseMove: z
      .union([z.boolean(), z.enum(['shift', 'ctrl', 'alt'])])
      .optional(),
    moveOnMouseWheel: z
      .union([z.boolean(), z.enum(['shift', 'ctrl', 'alt'])])
      .optional(),
    preventDefaultMouseMove: z.boolean().optional(),
  });

// =============================================================================
// Toolbox Schema
// =============================================================================

export const toolboxSchema = z.object({
  id: z.string().optional(),
  show: z.boolean().optional(),
  orient: z.enum(['horizontal', 'vertical']).optional(),
  itemSize: z.number().optional(),
  itemGap: z.number().optional(),
  showTitle: z.boolean().optional(),
  feature: z.record(z.string(), z.unknown()).optional(),
  iconStyle: itemStyleSchema.optional(),
  emphasis: z.object({
      iconStyle: itemStyleSchema.optional(),
    }).optional(),
  zlevel: z.number().optional(),
  z: z.number().optional(),
  left: numberOrPercentSchema.optional(),
  top: numberOrPercentSchema.optional(),
  right: numberOrPercentSchema.optional(),
  bottom: numberOrPercentSchema.optional(),
  width: numberOrPercentSchema.optional(),
  height: numberOrPercentSchema.optional(),
});

// =============================================================================
// VisualMap Schema
// =============================================================================

export const visualMapSchema = z.object({
    type: z.enum(['continuous', 'piecewise']).optional(),
    id: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    range: z.array(z.number()).optional(),
    calculable: z.boolean().optional(),
    realtime: z.boolean().optional(),
    inverse: z.boolean().optional(),
    precision: z.number().optional(),
    itemWidth: z.number().optional(),
    itemHeight: z.number().optional(),
    align: z.enum(['auto', 'left', 'right', 'top', 'bottom']).optional(),
    text: z.array(z.string()).optional(),
    textGap: z.number().optional(),
    show: z.boolean().optional(),
    dimension: z.union([z.number(), z.string()]).optional(),
    seriesIndex: z.union([z.number(), z.array(z.number())]).optional(),
    hoverLink: z.boolean().optional(),
    inRange: z.record(z.string(), z.unknown()).optional(),
    outOfRange: z.record(z.string(), z.unknown()).optional(),
    zlevel: z.number().optional(),
    z: z.number().optional(),
    left: numberOrPercentSchema.optional(),
    top: numberOrPercentSchema.optional(),
    right: numberOrPercentSchema.optional(),
    bottom: numberOrPercentSchema.optional(),
    orient: z.enum(['horizontal', 'vertical']).optional(),
    padding: z.union([z.number(), z.array(z.number())]).optional(),
    backgroundColor: colorSchema.optional(),
    borderColor: colorSchema.optional(),
    borderWidth: z.number().optional(),
    color: z.array(colorSchema).optional(),
    textStyle: textStyleSchema.optional(),
    splitNumber: z.number().optional(),
    pieces: z.array(z.record(z.string(), z.unknown())).optional(),
    categories: z.array(z.string()).optional(),
    minOpen: z.boolean().optional(),
    maxOpen: z.boolean().optional(),
    selectedMode: z
      .union([z.boolean(), z.enum(['single', 'multiple'])])
      .optional(),
    showLabel: z.boolean().optional(),
    itemGap: z.number().optional(),
    itemSymbol: symbolTypeSchema.optional(),
  });

// =============================================================================
// Series Schema
// =============================================================================

const emphasisSchema = z.object({
    disabled: z.boolean().optional(),
    focus: z
      .enum(['none', 'self', 'series', 'ancestor', 'descendant', 'relative'])
      .optional(),
    blurScope: z.enum(['coordinateSystem', 'series', 'global']).optional(),
    scale: z.union([z.boolean(), z.number()]).optional(),
    label: labelSchema.optional(),
    itemStyle: itemStyleSchema.optional(),
    lineStyle: lineStyleSchema.optional(),
    areaStyle: areaStyleSchema.optional(),
  });

const stateSchema = z.object({
    label: labelSchema.optional(),
    itemStyle: itemStyleSchema.optional(),
    lineStyle: lineStyleSchema.optional(),
    areaStyle: areaStyleSchema.optional(),
  });

export const seriesSchema = z.object({
    type: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    colorBy: z.enum(['series', 'data']).optional(),
    legendHoverLink: z.boolean().optional(),
    coordinateSystem: z.string().optional(),
    xAxisIndex: z.number().optional(),
    yAxisIndex: z.number().optional(),
    polarIndex: z.number().optional(),
    geoIndex: z.number().optional(),
    calendarIndex: z.number().optional(),
    label: labelSchema.optional(),
    labelLine: z
      .object({
        show: z.boolean().optional(),
        showAbove: z.boolean().optional(),
        length: z.number().optional(),
        length2: z.number().optional(),
        smooth: z.union([z.boolean(), z.number()]).optional(),
        minTurnAngle: z.number().optional(),
        lineStyle: lineStyleSchema.optional(),
      })
            .optional(),
    labelLayout: z
      .object({
        hideOverlap: z.boolean().optional(),
        moveOverlap: z.enum(['shiftX', 'shiftY']).optional(),
      })
            .optional(),
    itemStyle: itemStyleSchema.optional(),
    lineStyle: lineStyleSchema.optional(),
    areaStyle: areaStyleSchema.optional(),
    emphasis: emphasisSchema.optional(),
    blur: stateSchema.optional(),
    select: stateSchema.optional(),
    selectedMode: z
      .union([z.boolean(), z.enum(['single', 'multiple', 'series'])])
      .optional(),
    zlevel: z.number().optional(),
    z: z.number().optional(),
    silent: z.boolean().optional(),
    cursor: z.string().optional(),
    animation: z.boolean().optional(),
    animationThreshold: z.number().optional(),
    animationDuration: z.number().optional(),
    animationEasing: z.string().optional(),
    animationDelay: z.number().optional(),
    animationDurationUpdate: z.number().optional(),
    animationEasingUpdate: z.string().optional(),
    animationDelayUpdate: z.number().optional(),
  });

// =============================================================================
// Graphic Schema
// =============================================================================

export const graphicElementSchema = z.object({
    type: z
      .enum([
        'group',
        'image',
        'text',
        'rect',
        'circle',
        'ring',
        'sector',
        'arc',
        'polygon',
        'polyline',
        'line',
        'bezierCurve',
      ])
      .optional(),
    id: z.string().optional(),
    $action: z.enum(['merge', 'replace', 'remove']).optional(),
    left: numberOrPercentSchema.optional(),
    top: numberOrPercentSchema.optional(),
    right: numberOrPercentSchema.optional(),
    bottom: numberOrPercentSchema.optional(),
    bounding: z.enum(['all', 'raw']).optional(),
    z: z.number().optional(),
    zlevel: z.number().optional(),
    silent: z.boolean().optional(),
    invisible: z.boolean().optional(),
    cursor: z.string().optional(),
    draggable: z
      .union([z.boolean(), z.enum(['horizontal', 'vertical'])])
      .optional(),
    progressive: z.boolean().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    shape: z.record(z.string(), z.unknown()).optional(),
    style: z.record(z.string(), z.unknown()).optional(),
    rotation: z.number().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    originX: z.number().optional(),
    originY: z.number().optional(),
    children: z.array(z.record(z.string(), z.unknown())).optional(),
  });

// =============================================================================
// AxisPointer Schema
// =============================================================================

export const axisPointerSchema = z.object({
  id: z.string().optional(),
  show: z.boolean().optional(),
  type: z.enum(['line', 'shadow', 'none']).optional(),
  snap: z.boolean().optional(),
  z: z.number().optional(),
  label: z
    .object({
      show: z.boolean().optional(),
      precision: z.union([z.number(), z.literal('auto')]).optional(),
      margin: z.number().optional(),
      color: colorSchema.optional(),
      fontStyle: fontStyleSchema.optional(),
      fontWeight: fontWeightSchema.optional(),
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      lineHeight: z.number().optional(),
      backgroundColor: colorSchema.optional(),
      borderColor: colorSchema.optional(),
      borderWidth: z.number().optional(),
      borderRadius: z.number().optional(),
      padding: z.union([z.number(), z.array(z.number())]).optional(),
      shadowBlur: z.number().optional(),
      shadowColor: colorSchema.optional(),
      shadowOffsetX: z.number().optional(),
      shadowOffsetY: z.number().optional(),
    })
        .optional(),
  lineStyle: lineStyleSchema.optional(),
  shadowStyle: areaStyleSchema.optional(),
  triggerTooltip: z.boolean().optional(),
  value: z.number().optional(),
  status: z.enum(['show', 'hide']).optional(),
  handle: z
    .object({
      show: z.boolean().optional(),
      icon: z.string().optional(),
      size: z.union([z.number(), z.array(z.number())]).optional(),
      margin: z.number().optional(),
      color: colorSchema.optional(),
      throttle: z.number().optional(),
      shadowBlur: z.number().optional(),
      shadowColor: colorSchema.optional(),
      shadowOffsetX: z.number().optional(),
      shadowOffsetY: z.number().optional(),
    })
        .optional(),
  link: z.array(z.record(z.string(), z.unknown())).optional(),
});

// =============================================================================
// Root Schema - CustomEChartOptions
// =============================================================================

/**
 * Helper to create schema that accepts object or array of objects
 */
function objectOrArray<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema)]);
}

/**
 * Main ECharts Options Schema
 *
 * This schema validates user-provided custom ECharts options.
 * It intentionally excludes function callbacks for security.
 */
export const customEChartOptionsSchema = z.object({
  // Global options
  backgroundColor: colorSchema.optional(),
  darkMode: z.union([z.boolean(), z.literal('auto')]).optional(),
  textStyle: textStyleSchema.optional(),
  useUTC: z.boolean().optional(),

  // Animation options
  animation: z.boolean().optional(),
  animationThreshold: z.number().optional(),
  animationDuration: z.number().optional(),
  animationEasing: z.string().optional(),
  animationDelay: z.number().optional(),
  animationDurationUpdate: z.number().optional(),
  animationEasingUpdate: z.string().optional(),
  animationDelayUpdate: z.number().optional(),
  stateAnimation: z
    .object({
      duration: z.number().optional(),
      easing: z.string().optional(),
    })
    .optional(),

  // Component options (can be object or array)
  title: objectOrArray(titleSchema).optional(),
  legend: objectOrArray(legendSchema).optional(),
  grid: objectOrArray(gridSchema).optional(),
  xAxis: objectOrArray(axisSchema).optional(),
  yAxis: objectOrArray(axisSchema).optional(),
  tooltip: tooltipSchema.optional(),
  toolbox: toolboxSchema.optional(),
  dataZoom: objectOrArray(dataZoomSchema).optional(),
  visualMap: objectOrArray(visualMapSchema).optional(),
  axisPointer: axisPointerSchema.optional(),
  graphic: objectOrArray(graphicElementSchema).optional(),
  series: objectOrArray(seriesSchema).optional(),
});

// =============================================================================
// Type Exports (inferred from Zod schemas)
// =============================================================================

export type TextStyleOption = z.infer<typeof textStyleSchema>;
export type LineStyleOption = z.infer<typeof lineStyleSchema>;
export type AreaStyleOption = z.infer<typeof areaStyleSchema>;
export type ItemStyleOption = z.infer<typeof itemStyleSchema>;
export type LabelOption = z.infer<typeof labelSchema>;
export type TitleOption = z.infer<typeof titleSchema>;
export type LegendOption = z.infer<typeof legendSchema>;
export type GridOption = z.infer<typeof gridSchema>;
export type AxisOption = z.infer<typeof axisSchema>;
export type TooltipOption = z.infer<typeof tooltipSchema>;
export type DataZoomOption = z.infer<typeof dataZoomSchema>;
export type ToolboxOption = z.infer<typeof toolboxSchema>;
export type VisualMapOption = z.infer<typeof visualMapSchema>;
export type SeriesOption = z.infer<typeof seriesSchema>;
export type GraphicElementOption = z.infer<typeof graphicElementSchema>;
export type AxisPointerOption = z.infer<typeof axisPointerSchema>;

/** Main custom ECharts options type */
export type CustomEChartOptions = z.infer<typeof customEChartOptionsSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates custom EChart options against the schema.
 * Returns a result object with success status and validated data or errors.
 */
export function validateEChartOptions(data: unknown) {
  return customEChartOptionsSchema.safeParse(data);
}

/**
 * Validates and returns only the valid portion of the options.
 * Invalid fields are stripped, not rejected.
 */
export function parseEChartOptionsStrict(data: unknown): CustomEChartOptions {
  const result = customEChartOptionsSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Return empty object on failure
  return {};
}

export default customEChartOptionsSchema;
