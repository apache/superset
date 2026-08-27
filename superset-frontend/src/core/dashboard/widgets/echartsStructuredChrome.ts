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
 * chrome (title/legend/tooltip/axis labels) — matching `EchartsChrome`'s
 * docstring in `superset/widgets/controls.py`: every leaf is optional and
 * applies (or not) on its own, regardless of `chartType`/`customize`. A leaf
 * left at its default never touches `echartsOptions`; when it does apply, it
 * merges onto — rather than replaces — the matching section, so an
 * unmanaged sibling property there (e.g. a hand-authored `legend.orient`)
 * survives.
 */

export interface EchartsChromeValue {
  title?: { text?: string };
  legend?: {
    show?: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right' | null;
  };
  tooltip?: { trigger?: 'item' | 'axis' | null };
  xAxis?: EchartsAxisChromeValue;
  yAxis?: EchartsAxisChromeValue;
}

export interface EchartsAxisChromeValue {
  name?: string;
  rotate?: number;
  format?: string;
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
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function applyTitle(
  existing: unknown,
  title: EchartsChromeValue['title'],
): unknown {
  if (!title?.text) return existing;
  return { ...asRecord(existing), text: title.text };
}

function applyLegend(
  existing: unknown,
  legend: EchartsChromeValue['legend'],
): unknown {
  const override: Record<string, unknown> = {};
  if (legend?.show === false) override.show = false;
  if (legend?.position)
    Object.assign(override, LEGEND_POSITION[legend.position]);
  if (Object.keys(override).length === 0) return existing;
  return { ...asRecord(existing), ...override };
}

function applyTooltip(
  existing: unknown,
  tooltip: EchartsChromeValue['tooltip'],
): unknown {
  if (!tooltip?.trigger) return existing;
  return { ...asRecord(existing), trigger: tooltip.trigger };
}

function applyAxis(
  existing: unknown,
  axis: EchartsAxisChromeValue | undefined,
): unknown {
  if (!axis) return existing;
  const existingRecord = asRecord(existing);
  const override: Record<string, unknown> = {};
  if (axis.name) override.name = axis.name;
  const axisLabelOverride: Record<string, unknown> = {};
  if (axis.rotate) axisLabelOverride.rotate = axis.rotate;
  if (axis.format) axisLabelOverride.formatter = axis.format;
  if (Object.keys(axisLabelOverride).length > 0) {
    override.axisLabel = {
      ...asRecord(existingRecord.axisLabel),
      ...axisLabelOverride,
    };
  }
  if (Object.keys(override).length === 0) return existing;
  return { ...existingRecord, ...override };
}

/**
 * Layers `chrome`'s leaves onto an already `$bind`-resolved raw option, one
 * independent merge per section (`title`/`legend`/`tooltip`/`xAxis`/
 * `yAxis`). Returns `resolved` unchanged (same reference) when every leaf is
 * at its default.
 */
export function applyStructuredChrome(
  resolved: Record<string, unknown>,
  chrome: EchartsChromeValue | undefined,
): Record<string, unknown> {
  if (!chrome) return resolved;
  const title = applyTitle(resolved.title, chrome.title);
  const legend = applyLegend(resolved.legend, chrome.legend);
  const tooltip = applyTooltip(resolved.tooltip, chrome.tooltip);
  const xAxis = applyAxis(resolved.xAxis, chrome.xAxis);
  const yAxis = applyAxis(resolved.yAxis, chrome.yAxis);
  if (
    title === resolved.title &&
    legend === resolved.legend &&
    tooltip === resolved.tooltip &&
    xAxis === resolved.xAxis &&
    yAxis === resolved.yAxis
  ) {
    return resolved;
  }
  return { ...resolved, title, legend, tooltip, xAxis, yAxis };
}
