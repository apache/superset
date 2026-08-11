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
 * @fileoverview Theming that a global `textStyle` cannot reach.
 *
 * v1 charts are theme-correct because each of ~40 `transformProps` files knows
 * which of *its* chart's elements are themeable — pie sets
 * `label.color = theme.colorText`, and so on. A generic option has no
 * `viz_type` to look that up by, which is why an AI-authored pie renders with a
 * white halo around every label: with no explicit label colour, zrender falls
 * back to drawing its own contrasting stroke (`zrender/graphic/Text.js`, the
 * `useDefaultFill` branch), on the assumption that text over an arbitrary mark
 * needs one.
 *
 * The fix does not need a `viz_type`. The option already says what it is —
 * `series[].type` — so per-chart-type theming can be derived from the option
 * itself, the same way `getEchartsTheme` already keys axis styling off whether
 * the option declares an axis.
 *
 * The same pass is where a series gets its colour by name rather than by
 * position. ECharts colours by index off the palette, so a category is one
 * colour in a chart that lists it second and another in a chart that lists it
 * fifth — on one dashboard, the same "EMEA" in three widgets in three colours.
 * `theme.getColor` is the shared label→colour memory, so asking it here makes
 * a canvas agree with itself and with the v1 charts beside it.
 *
 * Applied *after* the theme merge rather than as another merge source, because
 * `mergeEchartsThemeOverrides` replaces a destination array whenever a source
 * has one — so any `series` the theme layer contributed would be discarded the
 * moment the authored `series: [...]` merged over it, whatever the ordering.
 * Filling only absent keys afterwards gives the same precedence a merge would
 * have: whatever the author set explicitly is left alone.
 */

import type { ChartTheme } from './chartTheme';

/**
 * Series types whose *data items* are the categories rather than the series.
 *
 * A bar series is one category and carries its name; a pie is one series of
 * many slices, each named. So the colour goes on the datum for these and on
 * the series for everything else.
 */
const CATEGORIES_ARE_DATA = new Set(['pie', 'funnel', 'treemap', 'sunburst']);

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Recursively writes `defaults` into `target` wherever `target` says nothing,
 * leaving every value it does specify untouched. Returns a copy.
 */
function fillAbsent(target: unknown, defaults: Dict): unknown {
  if (!isDict(target)) {
    // An author who set this key to a non-object meant it — even `null`, which
    // is how ECharts is told to drop something.
    return target === undefined ? defaults : target;
  }
  const out: Dict = { ...target };
  Object.entries(defaults).forEach(([key, value]) => {
    if (isDict(value)) {
      out[key] = fillAbsent(out[key], value);
    } else if (out[key] === undefined) {
      out[key] = value;
    }
  });
  return out;
}

/**
 * The theme's opinion about one series type, as an ECharts series fragment.
 *
 * `label.color` is the load-bearing entry and applies to every type: it is
 * absent-by-default in ECharts, and its absence is exactly what triggers the
 * white auto-stroke. Setting it is what v1's `transformProps` files each do by
 * hand.
 */
function seriesDefaults(type: string | undefined, theme: ChartTheme): Dict {
  const label = { color: theme.text.color, fontFamily: theme.text.fontFamily };

  switch (type) {
    case 'pie':
    case 'funnel':
      return {
        label,
        // Leader lines default to the slice colour, which reads as chart junk
        // once there are more than a handful of slices.
        labelLine: { lineStyle: { color: theme.axis.lineColor } },
        // Slice borders separate neighbours whose colours are adjacent in the
        // palette; the container colour makes them read as gaps rather than
        // outlines.
        itemStyle: { borderColor: theme.tooltip.background },
      };
    case 'treemap':
    case 'sunburst':
      return { label, itemStyle: { borderColor: theme.tooltip.background } };
    case 'gauge':
      return {
        // A gauge's detail/title sit inside the dial, over the axis line.
        label,
        detail: { color: theme.text.color },
        title: { color: theme.text.mutedColor },
      };
    case 'heatmap':
      return { label, itemStyle: { borderColor: theme.tooltip.background } };
    default:
      return { label };
  }
}

/**
 * Colours one series by what it is called, where the author said nothing.
 *
 * Left absent, ECharts takes the next colour off the palette by position. An
 * explicit colour in the spec is untouched, so a chart that means to be red
 * stays red.
 */
function colorByName(series: Dict, theme: ChartTheme): Dict {
  const type = series.type as string | undefined;

  if (type !== undefined && CATEGORIES_ARE_DATA.has(type)) {
    const { data } = series;
    if (!Array.isArray(data)) {
      return series;
    }
    return {
      ...series,
      data: data.map(datum =>
        isDict(datum) && typeof datum.name === 'string'
          ? fillAbsent(datum, {
              itemStyle: { color: theme.getColor(datum.name) },
            })
          : datum,
      ),
    };
  }

  return typeof series.name === 'string'
    ? (fillAbsent(series, {
        itemStyle: { color: theme.getColor(series.name) },
      }) as Dict)
    : series;
}

/**
 * Fills in per-series-type theming the author left unspecified.
 *
 * Deliberately additive: an option that sets its own `label.color` keeps it, so
 * this costs nothing in expressiveness. It only decides what happens when the
 * author says nothing — which today means "whatever the charting library
 * guesses", and for labels that guess is a white halo.
 */
export function applySeriesDefaults(option: Dict, theme: ChartTheme): Dict {
  const { series } = option;
  if (!series) return option;

  if (Array.isArray(series)) {
    return {
      ...option,
      series: series.map(item =>
        isDict(item)
          ? colorByName(
              fillAbsent(
                item,
                seriesDefaults(item.type as string, theme),
              ) as Dict,
              theme,
            )
          : item,
      ),
    };
  }
  if (isDict(series)) {
    return {
      ...option,
      series: colorByName(
        fillAbsent(
          series,
          seriesDefaults(series.type as string, theme),
        ) as Dict,
        theme,
      ),
    };
  }
  return option;
}

export default applySeriesDefaults;
