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

import { t } from '@apache-superset/core/translation';
// eslint-disable-next-line import/no-unresolved
import { Feature } from 'geojson';
import { LegendProps } from '../../components/Legend';
import { ColorBreakpointType } from '../../types';
import { getColorBreakpointsBuckets, NULL_CATEGORY_KEY } from '../../utils';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { RGBAColor, VectorTileLayerSettings } from './layerSettings';
import { createCategoryColor } from './styling';

/** Most category rows the legend lists before summarising the rest. */
export const MAX_LEGEND_CATEGORIES = 10;

export type LegendCategories = LegendProps['categories'];

/** deck.gl adds `dataInWGS84` (the tile's features as GeoJSON) to MVT tiles. */
type LoadedTile = { dataInWGS84?: Feature[] | null };

/** Category text for a value; the same text the colour expression produces. */
const toCategory = (value: unknown): string =>
  value == null ? NULL_CATEGORY_KEY : String(value);

/**
 * Lists the most frequent categories among the given features, most frequent
 * first, with a final "+ N more" row when some are left out.
 */
export function buildCategoryLegend(
  features: Feature[],
  property: string,
  colorFor: (category: string) => RGBAColor,
  maxRows = MAX_LEGEND_CATEGORIES,
): LegendCategories {
  const counts = new Map<string, number>();
  features.forEach(feature => {
    const category = toCategory(feature.properties?.[property]);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });
  const sorted = [...counts.entries()].sort(
    ([a, countA], [b, countB]) => countB - countA || a.localeCompare(b),
  );

  const categories: LegendCategories = {};
  sorted.slice(0, maxRows).forEach(([category]) => {
    categories[category] = { color: colorFor(category), enabled: true };
  });
  const hidden = sorted.length - maxRows;
  if (hidden > 0) {
    categories[t('+ %s more', hidden)] = { color: undefined, enabled: true };
  }
  return categories;
}

/**
 * Legend rows for the active colour mode: the breakpoint ranges, or the
 * categories in the loaded tiles. Empty for Fixed, which hides the legend.
 */
export function getLegendCategories(
  settings: VectorTileLayerSettings,
  colorBreakpoints: ColorBreakpointType[] | undefined,
  tiles: unknown[],
  sliceId?: number,
): LegendCategories {
  const { colorSchemeType, colorProperty, breakpointProperty } = settings;

  if (
    colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints &&
    breakpointProperty
  ) {
    return getColorBreakpointsBuckets(colorBreakpoints ?? []);
  }

  if (
    colorSchemeType === COLOR_SCHEME_TYPES.categorical_palette &&
    colorProperty
  ) {
    // Read here, not in onViewportLoad: deck.gl attaches dataInWGS84 to newly
    // loaded tiles only after that callback runs.
    const features = tiles.flatMap(
      tile => (tile as LoadedTile).dataInWGS84 ?? [],
    );
    return buildCategoryLegend(
      features,
      colorProperty,
      createCategoryColor(settings.colorScheme, settings.fillColor[3], sliceId),
    );
  }

  return {};
}
