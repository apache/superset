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
import type { SupersetTheme } from '@apache-superset/core/theme';

/**
 * Derives the ECharts styling implied by the active theme's tokens — text,
 * legend, tooltip, axis-pointer, and (when the chart declares them) axis
 * colors.
 *
 * Lives here rather than inside `Echart.tsx` because that component isn't the
 * only renderer: the Dashboard v2 widgets draw AI-authored options on a bare
 * `echarts.init` canvas, bypassing `SuperChart`/`ChartPlugin` entirely, and
 * without this they render ECharts' stock near-black text regardless of the
 * theme.
 *
 * Returns only what the theme implies — merge it *under* the chart's own
 * options (see `mergeEchartsThemeOverrides`) so anything the chart sets
 * explicitly still wins.
 */
export function getEchartsTheme(theme: SupersetTheme, options?: any) {
  const echartsTheme = {
    textStyle: {
      color: theme.colorText,
      fontFamily: theme.fontFamily,
    },
    title: {
      textStyle: { color: theme.colorText },
    },
    legend: {
      textStyle: { color: theme.colorTextSecondary },
      pageTextStyle: {
        color: theme.colorTextSecondary,
      },
      pageIconColor: theme.colorTextSecondary,
      pageIconInactiveColor: theme.colorTextDisabled,
      inactiveColor: theme.colorTextDisabled,
    },
    tooltip: {
      backgroundColor: theme.colorBgContainer,
      textStyle: { color: theme.colorText },
    },
    axisPointer: {
      lineStyle: { color: theme.colorPrimary },
      label: { color: theme.colorText },
    },
  } as any;

  // Only styled when the chart actually declares an axis — an axis section on a
  // pie or gauge option would otherwise draw a cartesian grid that isn't there.
  const axisTheme = {
    axisLine: { lineStyle: { color: theme.colorSplit } },
    axisLabel: { color: theme.colorTextSecondary },
    splitLine: { lineStyle: { color: theme.colorSplit } },
    minorSplitLine: {
      lineStyle: { color: theme.colorBorderSecondary },
    },
  };
  // ECharts accepts one axis or several. A single object merged over an
  // authored array is replaced wholesale by it, so a chart with two y-axes
  // lost every bit of axis styling the theme meant to give it — matched in
  // shape here instead, one default per authored axis.
  const forAxis = (axis: unknown) =>
    Array.isArray(axis) ? axis.map(() => axisTheme) : axisTheme;
  if (options?.xAxis) {
    echartsTheme.xAxis = forAxis(options.xAxis);
  }
  if (options?.yAxis) {
    echartsTheme.yAxis = forAxis(options.yAxis);
  }

  return echartsTheme;
}

export default getEchartsTheme;
