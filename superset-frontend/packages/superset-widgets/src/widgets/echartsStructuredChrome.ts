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
 * The `echarts` widget's second, independent structured layer — chart
 * chrome (legend/tooltip/axis labels) — matching `EchartsChrome`'s
 * docstring in `superset/widgets/controls.py`: every field is optional and
 * applies (or not) on its own, regardless of `chartType`/`customize`. A
 * field left at its default never touches `echartsOptions`; when it does
 * apply, it merges onto — rather than replaces — the matching section, so
 * an unmanaged sibling property there (e.g. a hand-authored `legend.orient`)
 * survives.
 *
 * `titleText` is the one field this layer doesn't apply: `ChartWidget`
 * always strips `echartsOptions.title` before handing the option to ECharts
 * (the widget's header draws the name instead, via `widgetLabel`, which
 * reads `titleText`/the raw title itself), so merging it here would only be
 * discarded downstream. See `widgetLabel.ts`'s `echartsTitle`.
 *
 * `EchartsChromeValue` is deliberately flat, not grouped into
 * `legend`/`tooltip`/`xAxis`/`yAxis` sub-objects — see `EchartsChrome`'s own
 * docstring: JsonForms' generated control panel only renders one level of
 * nested-object properties, so a two-level-deep `chrome.legend.show` would
 * render as an empty group with no fields inside.
 */

export interface EchartsChromeValue {
  titleText?: string;
  legendShow?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right' | null;
  tooltipTrigger?: 'item' | 'axis' | null;
  xAxisName?: string;
  xAxisRotate?: number;
  xAxisFormat?: string;
  yAxisName?: string;
  yAxisRotate?: number;
  yAxisFormat?: string;
}

// ECharts has no single "position" property on `legend` — placement comes
// from `top`/`left` (each accepting a keyword or coordinate). This maps the
// friendlier compass-direction picker onto the pair ECharts actually reads.
const LEGEND_POSITION: Record<string, { top: string; left: string }> = {
  top: { top: 'top', left: 'center' },
  bottom: { top: 'bottom', left: 'center' },
  left: { top: 'middle', left: 'left' },
  right: { top: 'middle', left: 'right' },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * ECharts accepts either one `title`/`legend`/`xAxis`/`yAxis` config or an
 * array of them (multi-axis charts, in particular, rely on `xAxis`/`yAxis`
 * arrays). Merging an override onto an array with a plain object spread
 * would convert it into an object keyed by numeric index, silently changing
 * its meaning — so an array's override always lands on its first entry
 * (ECharts' own convention for "the" axis/title/legend) and the rest of the
 * array is preserved as-is.
 */
function mergeSection(
  existing: unknown,
  override: Record<string, unknown>,
): unknown {
  if (Array.isArray(existing)) {
    const [first, ...rest] = existing;
    return [{ ...asRecord(first), ...override }, ...rest];
  }
  return { ...asRecord(existing), ...override };
}

function firstEntry(existing: unknown): unknown {
  return Array.isArray(existing) ? existing[0] : existing;
}

function applyLegend(existing: unknown, chrome: EchartsChromeValue): unknown {
  const override: Record<string, unknown> = {};
  if (chrome.legendShow === false) override.show = false;
  if (chrome.legendPosition) {
    Object.assign(override, LEGEND_POSITION[chrome.legendPosition]);
  }
  if (Object.keys(override).length === 0) return existing;
  return mergeSection(existing, override);
}

function applyTooltip(existing: unknown, chrome: EchartsChromeValue): unknown {
  if (!chrome.tooltipTrigger) return existing;
  return mergeSection(existing, { trigger: chrome.tooltipTrigger });
}

function applyAxis(
  existing: unknown,
  name: string | undefined,
  rotate: number | undefined,
  format: string | undefined,
): unknown {
  const existingRecord = asRecord(firstEntry(existing));
  const override: Record<string, unknown> = {};
  if (name) override.name = name;
  const axisLabelOverride: Record<string, unknown> = {};
  if (rotate) axisLabelOverride.rotate = rotate;
  if (format) axisLabelOverride.formatter = format;
  if (Object.keys(axisLabelOverride).length > 0) {
    override.axisLabel = {
      ...asRecord(existingRecord.axisLabel),
      ...axisLabelOverride,
    };
  }
  if (Object.keys(override).length === 0) return existing;
  return mergeSection(existing, override);
}

/**
 * Layers `chrome`'s fields onto an already `$bind`-resolved raw option, one
 * independent merge per section (`legend`/`tooltip`/`xAxis`/`yAxis`).
 * Returns `resolved` unchanged (same reference) when every field is at its
 * default. Doesn't touch `title` — see this file's own docstring.
 */
export function applyStructuredChrome(
  resolved: Record<string, unknown>,
  chrome: EchartsChromeValue | undefined,
): Record<string, unknown> {
  if (!chrome) return resolved;
  const legend = applyLegend(resolved.legend, chrome);
  const tooltip = applyTooltip(resolved.tooltip, chrome);
  const xAxis = applyAxis(
    resolved.xAxis,
    chrome.xAxisName,
    chrome.xAxisRotate,
    chrome.xAxisFormat,
  );
  const yAxis = applyAxis(
    resolved.yAxis,
    chrome.yAxisName,
    chrome.yAxisRotate,
    chrome.yAxisFormat,
  );
  if (
    legend === resolved.legend &&
    tooltip === resolved.tooltip &&
    xAxis === resolved.xAxis &&
    yAxis === resolved.yAxis
  ) {
    return resolved;
  }
  return { ...resolved, legend, tooltip, xAxis, yAxis };
}
