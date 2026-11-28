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
import {
  BinaryQueryObjectFilterClause,
  QueryObject,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { TreeLevel } from './types';

const isRange = (
  filter: QueryObjectFilterClause,
): filter is BinaryQueryObjectFilterClause => filter.op === 'TEMPORAL_RANGE';

/** The ranges on level 1's time column: the only ones that bound child time columns. */
const parentRanges = (base: QueryObject, levels: TreeLevel[]) =>
  (base.filters ?? [])
    .filter(isRange)
    .filter(filter => filter.col === levels[0]?.time_column);

/** Keep date ranges only and carry enabled ancestor ranges into a child query. */
export function childDateFilters(
  base: QueryObject,
  levels: TreeLevel[],
  c: number,
): QueryObjectFilterClause[] {
  const ranges = (base.filters ?? []).filter(isRange);
  const filters: QueryObjectFilterClause[] = [...ranges];
  const bounding = parentRanges(base, levels);
  for (let j = 1; j <= c; j += 1) {
    const level = levels[j];
    if (!level?.apply_date_filter || !level.time_column) continue;
    bounding.forEach(filter => {
      if (
        !filters.some(
          existing =>
            isRange(existing) &&
            existing.col === level.time_column &&
            existing.val === filter.val,
        )
      )
        filters.push({ ...filter, col: level.time_column! });
    });
  }
  return filters.slice(ranges.length);
}

export function childQueryBase(
  base: QueryObject,
  levels: TreeLevel[],
  c: number,
): QueryObject {
  const ranges = (base.filters ?? []).filter(isRange);
  return {
    ...base,
    filters: [...ranges, ...childDateFilters(base, levels, c)],
    extras: { ...base.extras, where: '', having: '' },
    granularity: undefined,
  };
}

export function childRangeApplies(
  base: QueryObject,
  levels: TreeLevel[],
  c: number,
): boolean {
  if (!levels[c]?.apply_date_filter || !levels[c].time_column) return false;
  return parentRanges(base, levels).some(filter => filter.val !== 'No filter');
}
