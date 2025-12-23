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
 * ECharts Schema Definition
 * 
 * Defines the structure and merge behavior for ECharts options based on the official documentation:
 * https://echarts.apache.org/en/option.html
 * 
 * This schema eliminates the need to hardcode property names and provides
 * self-documenting configuration handling.
 */

export type EChartsPropertyType = 'object' | 'array' | 'array-or-object' | 'primitive';

export type MergeStrategy = 
  | 'deep-merge'
  | 'merge-into-items'
  | 'set-if-missing'
  | 'replace';

export interface EChartsPropertySchema {
  type: EChartsPropertyType;
  mergeStrategy: MergeStrategy;
  description?: string;
}

/**
 * Schema for ECharts configuration options
 * Based on: https://echarts.apache.org/en/option.html
 * 
 * Properties are categorized by their merge behavior:
 * - deep-merge: Objects that should be deeply merged (tooltip, legend, etc.)
 * - merge-into-items: Arrays where each item should receive defaults (series, axes)
 * - set-if-missing: Arrays that are configuration, not styling (dataZoom, visualMap)
 */
export const ECHARTS_SCHEMA: Record<string, EChartsPropertySchema> = {
  // ========================================
  // COMPONENT GROUPS (merge into each item)
  // ========================================
  
  series: {
    type: 'array',
    mergeStrategy: 'merge-into-items',
    description: 'Series list. Each item is a series configuration (line, bar, pie, etc.)',
  },

  xAxis: {
    type: 'array-or-object',
    mergeStrategy: 'merge-into-items',
    description: 'X-axis configuration. Can be single axis or array for multiple x-axes',
  },

  yAxis: {
    type: 'array-or-object',
    mergeStrategy: 'merge-into-items',
    description: 'Y-axis configuration. Can be single axis or array for multiple y-axes',
  },

  grid: {
    type: 'array-or-object',
    mergeStrategy: 'merge-into-items',
    description: 'Grid component for drawing area. Can be array for multiple grids',
  },

  polar: {
    type: 'array-or-object',
    mergeStrategy: 'merge-into-items',
    description: 'Polar coordinate system',
  },

  radiusAxis: {
    type: 'array-or-object',
    mergeStrategy: 'merge-into-items',
    description: 'Radial axis of polar coordinate',
  },

  angleAxis: {
    type: 'array-or-object',
    mergeStrategy: 'merge-into-items',
    description: 'Angular axis of polar coordinate',
  },

  radar: {
    type: 'array-or-object',
    mergeStrategy: 'merge-into-items',
    description: 'Radar coordinate system component',
  },

  // ========================================
  // GLOBAL COMPONENTS (deep merge objects)
  // ========================================

  title: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Title component',
  },

  legend: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Legend component',
  },

  tooltip: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Tooltip component',
  },

  axisPointer: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Axis pointer configuration',
  },

  toolbox: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Toolbox component for feature tools',
  },

  brush: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Brush component for area selection',
  },

  geo: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Geographic coordinate system component',
  },

  parallel: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Parallel coordinate system',
  },

  parallelAxis: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Axis configuration in parallel coordinate system',
  },

  singleAxis: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Single axis component',
  },

  timeline: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Timeline component',
  },

  graphic: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Graphic component for custom graphics',
  },

  calendar: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Calendar coordinate system',
  },

  dataset: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Dataset component',
  },

  aria: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Accessibility configuration',
  },

  // ========================================
  // GLOBAL STYLING (deep merge)
  // ========================================

  color: {
    type: 'array',
    mergeStrategy: 'replace',
    description: 'Global color palette',
  },

  backgroundColor: {
    type: 'primitive',
    mergeStrategy: 'set-if-missing',
    description: 'Background color',
  },

  textStyle: {
    type: 'object',
    mergeStrategy: 'deep-merge',
    description: 'Global text style',
  },

  animation: {
    type: 'primitive',
    mergeStrategy: 'set-if-missing',
    description: 'Whether to enable animation',
  },

  animationDuration: {
    type: 'primitive',
    mergeStrategy: 'set-if-missing',
    description: 'Animation duration',
  },

  animationEasing: {
    type: 'primitive',
    mergeStrategy: 'set-if-missing',
    description: 'Animation easing function',
  },

  // ========================================
  // INTERACTIVE COMPONENTS (set if missing)
  // ========================================

  dataZoom: {
    type: 'array',
    mergeStrategy: 'set-if-missing',
    description: 'Data zoom component for zooming and panning. Usually user-controlled.',
  },

  visualMap: {
    type: 'array',
    mergeStrategy: 'set-if-missing',
    description: 'Visual mapping component for visual encoding',
  },

  // ========================================
  // ADVANCED (set if missing)
  // ========================================

  stateAnimation: {
    type: 'object',
    mergeStrategy: 'set-if-missing',
    description: 'State animation configuration',
  },

  blendMode: {
    type: 'primitive',
    mergeStrategy: 'set-if-missing',
    description: 'Blend mode for canvas rendering',
  },

  hoverLayerThreshold: {
    type: 'primitive',
    mergeStrategy: 'set-if-missing',
    description: 'Hover layer threshold',
  },

  useUTC: {
    type: 'primitive',
    mergeStrategy: 'set-if-missing',
    description: 'Whether to use UTC time',
  },
};


export function getMergeStrategy(propertyName: string): MergeStrategy {
  return ECHARTS_SCHEMA[propertyName]?.mergeStrategy ?? 'deep-merge';
}


export function shouldMergeIntoItems(propertyName: string): boolean {
  return getMergeStrategy(propertyName) === 'merge-into-items';
}


export function getPropertyType(propertyName: string): EChartsPropertyType | undefined {
  return ECHARTS_SCHEMA[propertyName]?.type;
}

