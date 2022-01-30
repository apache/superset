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
import { QueryObjectFilterClause, DrillDownType } from './types';
import { ensureIsArray } from '../utils';

export default class DrillDown {
  static fromHierarchy(hierarchy: string[]): DrillDownType {
    const mHierarchy = ensureIsArray(hierarchy);
    return {
      hierarchy: mHierarchy,
      currentIdx: mHierarchy.length > 0 ? 0 : -1,
      filters: [],
    };
  }

  static drillDown(value: DrillDownType, selectValue: string | Object): DrillDownType {
    const idx = value.currentIdx;
    const len = value.hierarchy.length;

    if (idx + 1 >= len) {
      return {
        hierarchy: value.hierarchy,
        currentIdx: 0,
        filters: [],
      };
    }

    const selection = (selectValue instanceof(Object)) ? selectValue[value.hierarchy[idx]] : selectValue;

    return {
      hierarchy: value.hierarchy,
      currentIdx: idx + 1,
      filters: value.filters.concat({
        col: value.hierarchy[idx],
        op: 'IN',
        val: [selection],
      }),
    };
  }

  static rollUp(value: DrillDownType): DrillDownType {
    const idx = value.currentIdx;
    const len = value.hierarchy.length;
    return {
      hierarchy: value.hierarchy,
      currentIdx: idx - 1 < 0 ? len - 1 : idx - 1,
      filters: value.filters.slice(0, -1),
    };
  }

  static getColumn(
    value: DrillDownType | undefined | null,
    hierarchy: string[],
  ): string {
    if (value) {
      return value.hierarchy[value.currentIdx];
    }
    const val = DrillDown.fromHierarchy(hierarchy);
    return val.hierarchy[val.currentIdx];
  }

  static getFilters(
    value: DrillDownType | undefined | null,
    hierarchy: string[],
  ): QueryObjectFilterClause[] {
    if (value) {
      return value.filters;
    }
    const val = DrillDown.fromHierarchy(hierarchy);
    return val.filters;
  }
}
