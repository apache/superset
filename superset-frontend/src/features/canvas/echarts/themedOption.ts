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

import { isPlainObject, mergeWith } from 'lodash-es';
import type { SupersetTheme } from '@apache-superset/core/theme';

type Option = Record<string, unknown>;

const axis = (theme: SupersetTheme) => ({
  nameTextStyle: { color: theme.colorTextSecondary },
  axisLine: { lineStyle: { color: theme.colorSplit } },
  axisLabel: { color: theme.colorTextSecondary },
  splitLine: { lineStyle: { color: theme.colorSplit } },
  minorSplitLine: { lineStyle: { color: theme.colorBorderSecondary } },
  breakArea: {
    itemStyle: {
      color: theme.colorBgContainer,
      borderColor: theme.colorBorder,
    },
  },
});

// Applied only when the option uses the component, so a default never adds
// an axis or calendar the author didn't ask for.
const COMPONENTS: Record<string, (theme: SupersetTheme) => Option> = {
  xAxis: axis,
  yAxis: axis,
  angleAxis: axis,
  radiusAxis: axis,
  singleAxis: axis,
  parallelAxis: axis,
  radar: theme => ({
    axisName: { color: theme.colorTextSecondary },
    axisLine: { lineStyle: { color: theme.colorSplit } },
    splitLine: { lineStyle: { color: theme.colorSplit } },
  }),
  calendar: theme => ({
    itemStyle: {
      color: theme.colorBgContainer,
      borderColor: theme.colorBorderSecondary,
    },
    splitLine: { lineStyle: { color: theme.colorBorder } },
    dayLabel: { color: theme.colorTextSecondary },
    monthLabel: { color: theme.colorTextSecondary },
    yearLabel: { color: theme.colorTextSecondary },
  }),
  visualMap: theme => ({ textStyle: { color: theme.colorTextSecondary } }),
};

// Arrays in a later source replace earlier ones; an object merged onto an
// array applies to each item, as for Superset's own ECharts charts.
const merge = (...sources: unknown[]): Option => {
  const customizer = (target: unknown, source: unknown): unknown => {
    if (Array.isArray(source)) return source;
    if (Array.isArray(target) && isPlainObject(source)) {
      return target.map(item =>
        isPlainObject(item) ? mergeWith({}, item, source, customizer) : item,
      );
    }
    return undefined;
  };
  return mergeWith({}, ...sources, customizer);
};

// Label positions outside a series' shapes, where ECharts' fixed dark grey
// would sit on the page background instead of on the shape.
const OUTSIDE_POSITIONS = new Set([
  'top',
  'bottom',
  'left',
  'right',
  'outside',
]);

/**
 * Series labels outlined in the background color (ECharts' white outline
 * ghosts light text in dark mode) and, when outside the shapes, in the theme's
 * text color. A series' own label settings win.
 */
function themedSeries(item: unknown, theme: SupersetTheme): unknown {
  if (!isPlainObject(item)) return item;
  const series = item as Option;
  const label = isPlainObject(series.label) ? (series.label as Option) : {};
  const position =
    label.position ?? (series.type === 'pie' ? 'outside' : undefined);
  const outside =
    typeof position === 'string' && OUTSIDE_POSITIONS.has(position);
  const defaults = {
    label: {
      textBorderColor: theme.colorBgContainer,
      ...(outside ? { color: theme.colorText } : {}),
    },
  };
  return merge(defaults, series);
}

const withColor = (item: Option, color: string | undefined): Option => {
  if (!color) return item;
  const itemStyle = isPlainObject(item.itemStyle)
    ? (item.itemStyle as Option)
    : {};
  return itemStyle.color === undefined
    ? { ...item, itemStyle: { ...itemStyle, color } }
    : item;
};

/**
 * The canvas's fixed label colors applied to series and named data items
 * that set no color of their own.
 */
export function withLabelColors(
  option: Option,
  labelColors: Record<string, string>,
): Option {
  if (!Object.keys(labelColors).length) return option;
  const colorSeries = (series: unknown): unknown => {
    if (!isPlainObject(series)) return series;
    const item = series as Option;
    const named = withColor(
      item,
      typeof item.name === 'string' ? labelColors[item.name] : undefined,
    );
    if (!Array.isArray(named.data)) return named;
    return {
      ...named,
      data: named.data.map(datum =>
        isPlainObject(datum) && typeof (datum as Option).name === 'string'
          ? withColor(
              datum as Option,
              labelColors[(datum as Option).name as string],
            )
          : datum,
      ),
    };
  };
  const { series } = option;
  return {
    ...option,
    series: Array.isArray(series)
      ? series.map(colorSeries)
      : colorSeries(series),
  };
}

/**
 * An ECharts option styled by the Superset theme: text, tooltips, legends and
 * the coordinate systems the option uses follow the theme (dark mode
 * included), the canvas's color scheme is the default palette, and the
 * theme's ECharts overrides apply last. Anything the option sets itself wins
 * over the defaults.
 */
export function themedOption(
  option: Option,
  theme: SupersetTheme,
  palette: string[],
): Option {
  const defaults: Option = {
    ...(palette.length > 0 ? { color: palette } : {}),
    backgroundColor: 'transparent',
    textStyle: { color: theme.colorText, fontFamily: theme.fontFamily },
    title: {
      textStyle: { color: theme.colorText },
      subtextStyle: { color: theme.colorTextSecondary },
    },
    legend: {
      textStyle: { color: theme.colorTextSecondary },
      pageTextStyle: { color: theme.colorTextSecondary },
      pageIconColor: theme.colorTextSecondary,
      pageIconInactiveColor: theme.colorTextDisabled,
      inactiveColor: theme.colorTextDisabled,
    },
    tooltip: {
      backgroundColor: theme.colorBgElevated,
      borderColor: theme.colorBorderSecondary,
      textStyle: { color: theme.colorText },
    },
    axisPointer: {
      lineStyle: { color: theme.colorPrimary },
      label: { color: theme.colorText },
    },
  };
  Object.entries(COMPONENTS).forEach(([key, style]) => {
    if (option[key] !== undefined) defaults[key] = style(theme);
  });
  const themed = merge(defaults, option, theme.echartsOptionsOverrides ?? {});
  const { series } = themed;
  if (Array.isArray(series)) {
    themed.series = series.map(item => themedSeries(item, theme));
  } else if (isPlainObject(series)) {
    themed.series = themedSeries(series, theme);
  }
  return themed;
}
