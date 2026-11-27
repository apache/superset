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
import { useEffect, useRef } from 'react';
import { ColDef, SortChangedEvent } from 'ag-grid-community';
import { ChildSort } from './types';

/** Show the effective direction when the configured column clears its override. */
export function getColumnSortingOrder(
  key: string,
  configuredSort: ChildSort,
): NonNullable<ColDef['sortingOrder']> {
  if (configuredSort?.[0] === key) {
    return configuredSort[1] ? ['desc', 'asc'] : ['asc', 'desc'];
  }
  return ['asc', 'desc', null];
}

/** Track the viewer's override independently of the effective server sort. */
export default function useColumnSort(
  sort: ChildSort,
  fallback: NonNullable<ChildSort>,
  configuredSort: ChildSort,
  onChange: (next: ChildSort) => void,
) {
  const viewer = useRef(sort);
  useEffect(() => {
    viewer.current = sort;
  }, [sort?.[0], sort?.[1]]);
  return ({
    api,
    source,
    columns,
  }: SortChangedEvent<Record<string, unknown>>) => {
    if (source !== 'uiColumnSorted') return;
    const column = columns?.find(item => item.getSort()) ?? columns?.[0];
    if (!column) return;
    const key = column.getColId();
    const previous = viewer.current;
    let next: ChildSort;
    if (configuredSort?.[0] === key) {
      const opposite = !configuredSort[1];
      next =
        previous?.[0] === key && previous[1] === opposite
          ? undefined
          : [key, opposite];
    } else {
      next =
        previous?.[0] !== key
          ? [key, true]
          : previous[1]
            ? [key, false]
            : undefined;
    }
    viewer.current = next;
    const effective = next ?? fallback;
    api.applyColumnState({
      defaultState: { sort: null },
      state: [{ colId: effective[0], sort: effective[1] ? 'asc' : 'desc' }],
    });
    onChange(next);
  };
}
