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
 * @fileoverview What the active theme means for a chart, stated without
 * reference to any charting library.
 *
 * Widgets draw with whatever renderer they like — ECharts, Vega-Lite, plain
 * SVG — and each library ships its own palette and its own near-black text.
 * Left to itself, every widget therefore looks like its library rather than
 * like Superset, and two widgets on one dashboard disagree about what "the
 * first series" is. The only affordance a contributed widget had here was
 * `getCategoricalColors()`, so each one hand-rolled the rest from raw tokens:
 * three extensions, three different mappings, all destined to drift.
 *
 * The fix is that theme compatibility should be the default a widget starts
 * from rather than something its author remembers to implement. So the host
 * states the theme once, semantically, and each renderer maps those few fields
 * onto its own config — a mapping that is a handful of lines, unlike
 * re-deriving what a theme means. A widget that genuinely wants different
 * colours still says so: its own spec is merged *over* this, never under it.
 *
 * Superset's sequential schemes are included because nothing was exposing them
 * at all, so any continuous colour a widget drew — a heatmap, a `visualMap`, a
 * choropleth — fell back to its library's default ramp. That is the most
 * visible mismatch of the lot, and the least excusable, since Superset has had
 * the schemes all along.
 */

import {
  CategoricalColorNamespace,
  getSequentialSchemeRegistry,
} from '@superset-ui/core';
import type { useTheme } from '@apache-superset/core/theme';

type Theme = ReturnType<typeof useTheme>;

export interface ChartTheme {
  /** Transparent, so a chart sits on the widget surface rather than over it. */
  background: string;
  text: {
    color: string;
    /** Text that labels rather than states — axis ticks, legend entries. */
    mutedColor: string;
    /** Text that is present but inactive — a toggled-off legend entry. */
    disabledColor: string;
    fontFamily: string;
    fontSize: number;
  };
  axis: {
    lineColor: string;
    labelColor: string;
    gridColor: string;
    /** Minor gridlines, where a renderer draws them. */
    minorGridColor: string;
  };
  tooltip: {
    background: string;
    color: string;
  };
  /** Accent for hover markers, crosshairs, selection. */
  accent: string;
  /** The active categorical scheme, in order. One colour per series. */
  categoricalColors: string[];
  /**
   * The colour for a named series or category.
   *
   * By position, "EMEA" is the second colour in a chart that lists it second
   * and the fifth in one that does not, so the same category comes out a
   * different colour in every widget it appears in — the thing that most makes
   * a set of widgets read as unrelated charts rather than as one dashboard.
   * Superset already solves this: the scale remembers what it gave a label and
   * gives it the same one again, which is also how the v1 charts beside a
   * canvas resolve theirs.
   */
  getColor: (label: string) => string;
  /**
   * The active sequential scheme, light to dark — for a continuous measure
   * (heatmap cells, a colour ramp), where a categorical palette is wrong.
   */
  sequentialColors: string[];
}

/**
 * The default sequential scheme's colours, or an empty list if none is
 * registered. Empty rather than a hardcoded fallback ramp: a renderer that gets
 * nothing keeps its own default, which is a better outcome than inventing a
 * Superset-looking ramp that no Superset chart actually uses.
 */
function getSequentialColors(): string[] {
  try {
    return getSequentialSchemeRegistry().get()?.colors ?? [];
  } catch {
    return [];
  }
}

/**
 * Reads live rather than being captured once: the active colour scheme and the
 * light/dark theme can both change after any given module was imported.
 *
 * `scheme` is the canvas's own choice of categorical palette, stored on its
 * root node; omitted, the deployment's default is used. Passed through to the
 * scale rather than resolved here so that the label→colour memory is the
 * shared one — a canvas and the v1 charts around it agree on what colour
 * "EMEA" is.
 */
export function getChartTheme(theme: Theme, scheme?: string): ChartTheme {
  const scale = CategoricalColorNamespace.getScale(scheme);
  return {
    background: 'transparent',
    text: {
      color: theme.colorText,
      mutedColor: theme.colorTextSecondary,
      disabledColor: theme.colorTextDisabled,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    },
    axis: {
      lineColor: theme.colorSplit,
      labelColor: theme.colorTextSecondary,
      gridColor: theme.colorSplit,
      minorGridColor: theme.colorBorderSecondary,
    },
    tooltip: {
      background: theme.colorBgContainer,
      color: theme.colorText,
    },
    accent: theme.colorPrimary,
    categoricalColors: scale.colors,
    getColor: (label: string) => scale.getColor(label),
    sequentialColors: getSequentialColors(),
  };
}

export default getChartTheme;
