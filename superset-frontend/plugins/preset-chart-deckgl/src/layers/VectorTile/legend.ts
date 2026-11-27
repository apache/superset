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
import { NULL_CATEGORY_KEY } from '../../utils';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { RGBAColor, VectorTileLayerSettings } from './layerSettings';
import { createCategoryColor } from './styling';

/** Most category rows the legend lists before summarising the rest. */
export const MAX_LEGEND_CATEGORIES = 10;

export type LegendCategories = LegendProps['categories'];

/** Binary features from @loaders.gl/mvt; only the fields the legend reads. */
type BinaryGeometry = {
  positions: { value: ArrayLike<number>; size: number };
  featureIds: { value: ArrayLike<number> };
  numericProps?: Record<string, { value: ArrayLike<number> }>;
  properties?: Record<string, unknown>[];
};

/** A loaded MVT tile: binary features, or GeoJSON when deck.gl skips binary mode. */
type LoadedTile = {
  content?:
    | Feature[]
    | {
        points?: BinaryGeometry;
        lines?: BinaryGeometry;
        polygons?: BinaryGeometry;
      }
    | null;
};

/** True when a tile-local position (0–1) is inside the tile, not in the buffer. */
const isInsideTile = (x: number, y: number) =>
  x >= 0 && x < 1 && y >= 0 && y < 1;

/**
 * Reads a property for each feature straight from binary tile data, without
 * converting geometry. Features whose first vertex lies in the tile buffer are
 * skipped, so points near tile edges are counted once.
 */
function readBinaryValues(
  geometry: BinaryGeometry,
  property: string,
  skipBufferCopies: boolean,
): unknown[] {
  const ids = geometry.featureIds.value;
  const { value: positions, size } = geometry.positions;
  const numeric = geometry.numericProps?.[property]?.value;
  const values: unknown[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    const isFirstVertex = i === 0 || ids[i] !== ids[i - 1];
    if (
      isFirstVertex &&
      (!skipBufferCopies ||
        isInsideTile(positions[i * size], positions[i * size + 1]))
    ) {
      values.push(
        numeric ? numeric[i] : geometry.properties?.[ids[i]]?.[property],
      );
    }
  }
  return values;
}

/**
 * Reads a property for each feature straight from binary tile data, without
 * converting geometry. Points copied into a tile's buffer are skipped so each
 * is counted once; lines and polygons spanning several tiles are counted once
 * per tile, since the tile server cuts them at tile edges.
 */

export function readTileValues(tiles: unknown[], property: string): unknown[] {
  return tiles.flatMap(tile => {
    const { content } = tile as LoadedTile;
    if (!content) {
      return [];
    }
    if (Array.isArray(content)) {
      return content.map(feature => feature.properties?.[property]);
    }
    return [
      ...(content.points
        ? readBinaryValues(content.points, property, true)
        : []),
      ...(content.lines
        ? readBinaryValues(content.lines, property, false)
        : []),
      ...(content.polygons
        ? readBinaryValues(content.polygons, property, false)
        : []),
    ];
  });
}

/** Category text for a value; the same text the colour expression produces. */
const toCategory = (value: unknown): string =>
  value == null ? NULL_CATEGORY_KEY : String(value);

/**
 * Lists the most frequent categories among the given features, most frequent
 * first, with a final "+ N more" row when some are left out.
 */
export function buildCategoryLegend(
  values: unknown[],
  colorFor: (category: string) => RGBAColor,
  maxRows = MAX_LEGEND_CATEGORIES,
): LegendCategories {
  const counts = new Map<string, number>();
  values.forEach(value => {
    const category = toCategory(value);
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
    categories[t('+ %s more', hidden)] = { color: [0, 0, 0, 0], enabled: true };
  }
  return categories;
}

/**
 * Legend rows for the active colour mode: the breakpoint ranges, or the
 * categories in the loaded tiles. Empty for Fixed, which hides the legend.
 */
export function getLegendCategories(
  settings: VectorTileLayerSettings,
  tiles: unknown[],
  sliceId?: number,
): LegendCategories {
  const { colorSchemeType, colorProperty, breakpointProperty } = settings;

  if (
    colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints &&
    breakpointProperty
  ) {
    // Same " - " label format as other deck.gl charts, so Legend Format
    // applies to both numbers.
    return Object.fromEntries(
      settings.colorBreakpoints.map(({ minValue, maxValue, color }) => [
        `${minValue} - ${maxValue}`,
        { color, enabled: true },
      ]),
    );
  }

  if (
    colorSchemeType === COLOR_SCHEME_TYPES.categorical_palette &&
    colorProperty
  ) {
    return buildCategoryLegend(
      readTileValues(tiles, colorProperty),
      createCategoryColor(settings.colorScheme, sliceId),
    );
  }

  return {};
}
