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
import { LegendOrientation, LegendType } from '../types';
import { getLegendLayoutResult, LegendLayoutResult } from './series';

type LegendDataItem =
  | string
  | number
  | null
  | undefined
  | { name?: string | number | null };

export type ResolvedLegendLayout = {
  effectiveLegendMargin?: string | number | null;
  effectiveLegendType: LegendType;
  legendLayout: LegendLayoutResult;
};

// ECharts default spacing for a horizontal, top-aligned legend: the icon
// itself, the gap between icon and label, and the gap before the next item.
const LEGEND_ITEM_ICON_WIDTH = 25;
const LEGEND_ITEM_ICON_GAP = 5;
const LEGEND_ITEM_INTER_GAP = 10;
const LEGEND_ITEM_OVERHEAD =
  LEGEND_ITEM_ICON_WIDTH + LEGEND_ITEM_ICON_GAP + LEGEND_ITEM_INTER_GAP;

/**
 * Estimates how many rows a horizontal, top-aligned legend will wrap onto
 * for a given chart width, so callers can reserve enough `grid.top` space to
 * avoid the legend overlapping the plot. ECharts only reports this after a
 * render, so this is a best-effort estimate from item label lengths using
 * the library's default per-item spacing; it degrades gracefully (a slight
 * under/over-reservation) rather than needing an extra render pass.
 */
export function estimateWrappedLegendRowCount({
  names,
  availableWidth,
  theme,
}: {
  names: string[];
  availableWidth: number;
  theme: SupersetTheme;
}): number {
  const avgCharWidth = theme.fontSize * 0.6;
  const available = Math.max(availableWidth, 1);
  let rows = 1;
  let cursor = 0;
  names.forEach(name => {
    const itemWidth = LEGEND_ITEM_OVERHEAD + name.length * avgCharWidth;
    if (cursor > 0 && cursor + itemWidth > available) {
      rows += 1;
      cursor = 0;
    }
    cursor += itemWidth;
  });
  return rows;
}

export function resolveLegendLayout(args: {
  availableHeight?: number;
  availableWidth?: number;
  chartHeight: number;
  chartWidth: number;
  legendItems?: LegendDataItem[];
  legendMargin?: string | number | null;
  orientation: LegendOrientation;
  show: boolean;
  showSelectors?: boolean;
  theme: SupersetTheme;
  type: LegendType;
}): ResolvedLegendLayout {
  const legendLayout = getLegendLayoutResult(args);

  return {
    effectiveLegendMargin: legendLayout.effectiveMargin ?? args.legendMargin,
    effectiveLegendType: legendLayout.effectiveType,
    legendLayout,
  };
}
