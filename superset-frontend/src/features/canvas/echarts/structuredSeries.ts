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
 * The `echarts` widget's structured series layer, per `chartType` and
 * `customize` in `superset/widgets/controls.py`: with `chartType` set, the
 * option's `series` is replaced by one series of that type per
 * `dataBinding` metric, styled by `customize.series`. Unset ("Custom"), the
 * option's own `series` is left as authored.
 */

type ChartType = 'bar' | 'line' | 'scatter';

interface SeriesOverride {
  color?: string;
  visible?: boolean;
  displayName?: string;
}

export interface StructuredProps {
  chartType?: ChartType | null;
  dataBinding?: {
    metrics?: unknown[];
    dimensions?: unknown[];
  };
  customize?: { series?: Record<string, SeriesOverride> };
}

/** The column a metric or dimension comes back as: its name, or its label. */
const labelOf = (item: unknown): string | undefined => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'label' in item) {
    const { label } = item as { label?: unknown };
    return typeof label === 'string' ? label : undefined;
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const bind = (source: 'metric' | 'dimension', alias: string) => ({
  $bind: { source, alias },
});

/**
 * Lays the structured series onto a raw, not yet `$bind`-resolved option.
 * Returns `option` itself when `chartType` is unset.
 */
export function applyStructuredSeries(
  option: Record<string, unknown>,
  props: StructuredProps | undefined,
): Record<string, unknown> {
  const chartType = props?.chartType;
  if (!chartType) return option;
  const overrides = props?.customize?.series ?? {};
  const series = (props?.dataBinding?.metrics ?? [])
    .map(labelOf)
    .filter((label): label is string => Boolean(label))
    .filter(label => overrides[label]?.visible !== false)
    .map(label => {
      const override = overrides[label] ?? {};
      return {
        type: chartType,
        name: override.displayName || label,
        data: bind('metric', label),
        ...(override.color ? { itemStyle: { color: override.color } } : {}),
      };
    });
  // A category axis over the first dimension, unless the option has its own.
  const dimension = labelOf(props?.dataBinding?.dimensions?.[0]);
  const { xAxis, yAxis } = option;
  const categoryAxis =
    isRecord(xAxis) && xAxis.data === undefined && dimension
      ? { ...xAxis, data: bind('dimension', dimension) }
      : xAxis;
  return {
    ...option,
    xAxis:
      xAxis === undefined && dimension
        ? { type: 'category', data: bind('dimension', dimension) }
        : categoryAxis,
    yAxis: yAxis === undefined ? { type: 'value' } : yAxis,
    series,
  };
}
