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
import regions from './regions';

export type RegionFormat = 'name' | 'abbreviation' | 'iso_3166_2';

interface Boundary {
  properties: { ISO?: string; NAME_1?: string; NAME_2?: string };
}

/** Index immutable aliases once per transform, preserving ambiguity checks. */
function createRegionResolver(
  boundaries: Boundary[],
  format: RegionFormat,
): (value: unknown) => string {
  const fold = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '');
  const entries = boundaries.flatMap(({ properties: p }) => {
    if (!p.ISO) return [];
    const alias =
      format === 'name'
        ? p.NAME_2 || p.NAME_1
        : format === 'abbreviation'
          ? p.ISO.split('-').slice(1).join('-')
          : p.ISO;
    return alias ? [{ alias, code: p.ISO }] : [];
  });
  const exactIndex = new Map<string, Set<string>>();
  const foldedIndex = new Map<string, Set<string>>();
  entries.forEach(({ alias, code }) => {
    for (const [index, key] of [
      [exactIndex, alias],
      [foldedIndex, fold(alias)],
    ] as const) {
      const codes = index.get(key) ?? new Set<string>();
      codes.add(code);
      index.set(key, codes);
    }
  });
  return value => {
    if (typeof value !== 'string' || !value || value.length > 500) {
      throw new Error(
        'Geographic values must be nonempty strings of at most 500 characters',
      );
    }
    const matches = exactIndex.get(value) ?? foldedIndex.get(fold(value));
    if (matches?.size !== 1) {
      throw new Error(
        `${matches?.size ? 'Ambiguous' : 'Unrecognized'} region ${JSON.stringify(value.slice(0, 100))}; choose the matching country/region format or explicitly filter the dataset.`,
      );
    }
    return [...matches][0];
  };
}

/** Exact matches win; folded matches must resolve to one rendered boundary. */
export function resolveRegion(
  value: unknown,
  boundaries: Boundary[],
  format: RegionFormat,
): string {
  return createRegionResolver(boundaries, format)(value);
}

/** Normalize display-only values, leaving raw query/export records intact. */
export default function normalizeRegions(
  records: Record<string, unknown>[],
  entity: string,
  country: string,
  format: string,
): Record<string, unknown>[] {
  if (
    !['usa', 'canada', 'australia', 'japan', 'uk'].includes(country) ||
    !['name', 'abbreviation', 'iso_3166_2'].includes(format)
  ) {
    throw new Error(
      'Unsupported country or region_format for typed geographic chart',
    );
  }
  const boundaries = regions[country].map(([ISO, NAME_1]) => ({
    properties: { ISO, NAME_1 },
  }));
  const resolve = createRegionResolver(boundaries, format as RegionFormat);
  const seen = new Set<string>();
  return records.map(record => {
    const iso = resolve(record[entity]);
    if (seen.has(iso)) {
      throw new Error(
        `Multiple result rows resolve to ${iso}; normalize source values before aggregation.`,
      );
    }
    seen.add(iso);
    return { ...record, [entity]: iso };
  });
}
