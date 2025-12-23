/*
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

// Image imports
declare module '*.png' {
  const value: string;
  export default value;
}

// lodash.merge type declaration
declare module 'lodash.merge' {
  function merge<T extends object>(target: T, ...sources: Partial<T>[]): T;
  function merge(target: object, ...sources: object[]): object;
  export default merge;
}

// =============================================================================
// TIMESERIES CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Timeseries/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Timeseries/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Timeseries/EchartsTimeseries' {
  import { ComponentType } from 'react';
  const EchartsTimeseries: ComponentType<unknown>;
  export default EchartsTimeseries;
}

declare module '@superset-ui/plugin-chart-echarts/Timeseries/Regular/Line/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

declare module '@superset-ui/plugin-chart-echarts/Timeseries/Regular/Bar/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

declare module '@superset-ui/plugin-chart-echarts/Timeseries/types' {
  import { QueryFormData, ChartProps, TimeFormatter, AxisType } from '@superset-ui/core';

  export enum OrientationType {
    Vertical = 'vertical',
    Horizontal = 'horizontal',
  }

  export enum EchartsTimeseriesSeriesType {
    Line = 'line',
    Scatter = 'scatter',
    Smooth = 'smooth',
    Bar = 'bar',
    Start = 'start',
    Middle = 'middle',
    End = 'end',
  }

  export type EchartsTimeseriesFormData = QueryFormData & Record<string, unknown>;
  export interface EchartsTimeseriesChartProps extends ChartProps {
    formData: EchartsTimeseriesFormData;
  }
  export type TimeseriesChartTransformedProps = Record<string, unknown>;
}

// =============================================================================
// PIE CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Pie/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Pie/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Pie/EchartsPie' {
  import { ComponentType } from 'react';
  const EchartsPie: ComponentType<unknown>;
  export default EchartsPie;
}

declare module '@superset-ui/plugin-chart-echarts/Pie/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// FUNNEL CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Funnel/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Funnel/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Funnel/EchartsFunnel' {
  import { ComponentType } from 'react';
  const EchartsFunnel: ComponentType<unknown>;
  export default EchartsFunnel;
}

declare module '@superset-ui/plugin-chart-echarts/Funnel/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// GAUGE CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Gauge/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Gauge/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Gauge/EchartsGauge' {
  import { ComponentType } from 'react';
  const EchartsGauge: ComponentType<unknown>;
  export default EchartsGauge;
}

declare module '@superset-ui/plugin-chart-echarts/Gauge/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// RADAR CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Radar/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Radar/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Radar/EchartsRadar' {
  import { ComponentType } from 'react';
  const EchartsRadar: ComponentType<unknown>;
  export default EchartsRadar;
}

declare module '@superset-ui/plugin-chart-echarts/Radar/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// TREEMAP CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Treemap/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Treemap/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Treemap/EchartsTreemap' {
  import { ComponentType } from 'react';
  const EchartsTreemap: ComponentType<unknown>;
  export default EchartsTreemap;
}

declare module '@superset-ui/plugin-chart-echarts/Treemap/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// MIXED TIMESERIES CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/MixedTimeseries/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/MixedTimeseries/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/MixedTimeseries/EchartsMixedTimeseries' {
  import { ComponentType } from 'react';
  const EchartsMixedTimeseries: ComponentType<unknown>;
  export default EchartsMixedTimeseries;
}

declare module '@superset-ui/plugin-chart-echarts/MixedTimeseries/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// BOX PLOT CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/BoxPlot/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/BoxPlot/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/BoxPlot/EchartsBoxPlot' {
  import { ComponentType } from 'react';
  const EchartsBoxPlot: ComponentType<unknown>;
  export default EchartsBoxPlot;
}

declare module '@superset-ui/plugin-chart-echarts/BoxPlot/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// GRAPH CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Graph/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Graph/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Graph/EchartsGraph' {
  import { ComponentType } from 'react';
  const EchartsGraph: ComponentType<unknown>;
  export default EchartsGraph;
}

declare module '@superset-ui/plugin-chart-echarts/Graph/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// SUNBURST CHART
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/Sunburst/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/Sunburst/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/Sunburst/EchartsSunburst' {
  import { ComponentType } from 'react';
  const EchartsSunburst: ComponentType<unknown>;
  export default EchartsSunburst;
}

declare module '@superset-ui/plugin-chart-echarts/Sunburst/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}

// =============================================================================
// BIG NUMBER CHARTS
// =============================================================================

declare module '@superset-ui/plugin-chart-echarts/BigNumber/BigNumberTotal/transformProps' {
  import { ChartProps } from '@superset-ui/core';
  export default function transformProps(chartProps: ChartProps): Record<string, unknown>;
}

declare module '@superset-ui/plugin-chart-echarts/BigNumber/BigNumberTotal/buildQuery' {
  export default function buildQuery(formData: Record<string, unknown>): unknown;
}

declare module '@superset-ui/plugin-chart-echarts/BigNumber/BigNumberViz' {
  import { ComponentType } from 'react';
  const BigNumberViz: ComponentType<unknown>;
  export default BigNumberViz;
}

declare module '@superset-ui/plugin-chart-echarts/BigNumber/BigNumberTotal/controlPanel' {
  import { ControlPanelConfig } from '@superset-ui/chart-controls';
  const config: ControlPanelConfig;
  export default config;
}
