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

export type HeaderGroupLabelAlign = 'left' | 'center' | 'right';

export type HeaderGroupPlacement = 'left' | 'right';

export type HeaderGroupConfig = {
  id: string;
  label: string;
  columns: string[];
  labelAlign?: HeaderGroupLabelAlign;
  placement?: HeaderGroupPlacement;
  source?: 'time_compare';
  children?: HeaderGroupConfig[];
};

export type HeaderGroupCell = {
  key: string;
  label: string;
  colSpan: number;
  rowSpan: number;
  labelAlign?: HeaderGroupLabelAlign;
  isLastColumn: boolean;
};

export function collectHeaderGroupLeaves(group: HeaderGroupConfig): string[] {
  return [
    ...(group.columns ?? []),
    ...(group.children ?? []).flatMap(collectHeaderGroupLeaves),
  ];
}

export function getHeaderGroupDepth(group: HeaderGroupConfig): number {
  const children = group.children ?? [];
  if (children.length === 0) {
    return 1;
  }
  return 1 + Math.max(...children.map(getHeaderGroupDepth));
}

export function getHeaderGroupsMaxDepth(groups: HeaderGroupConfig[]): number {
  if (groups.length === 0) {
    return 0;
  }
  return Math.max(...groups.map(getHeaderGroupDepth));
}

type AncestorInfo = {
  labels: string[];
  ids: string[];
  aligns: HeaderGroupLabelAlign[];
};

function buildAncestorMap(
  groups: HeaderGroupConfig[],
  ancestors: AncestorInfo = { labels: [], ids: [], aligns: [] },
  map: Map<string, AncestorInfo> = new Map(),
): Map<string, AncestorInfo> {
  groups.forEach(group => {
    const next = {
      labels: [...ancestors.labels, group.label],
      ids: [...ancestors.ids, group.id],
      aligns: [...ancestors.aligns, group.labelAlign ?? 'center'],
    };
    (group.columns ?? []).forEach(column => {
      if (!map.has(column)) {
        map.set(column, next);
      }
    });
    if (group.children?.length) {
      buildAncestorMap(group.children, next, map);
    }
  });
  return map;
}

function collectGroupedColumns<T extends { key: string }>(
  groups: HeaderGroupConfig[],
  byKey: Map<string, T>,
  seen: Set<string>,
): T[] {
  return groups.flatMap(collectHeaderGroupLeaves).reduce<T[]>((acc, key) => {
    const column = byKey.get(key);
    if (!column || seen.has(key)) {
      return acc;
    }
    seen.add(key);
    acc.push(column);
    return acc;
  }, []);
}

export function orderColumnsByHeaderGroups<T extends { key: string }>(
  columns: T[],
  groups: HeaderGroupConfig[],
): T[] {
  const leafKeys = groups.flatMap(collectHeaderGroupLeaves);
  const leafSet = new Set(leafKeys);
  const byKey = new Map(columns.map(column => [column.key, column]));
  const ungrouped = columns.filter(column => !leafSet.has(column.key));
  const seen = new Set<string>();
  const leftGroups = groups.filter(group => group.placement === 'left');
  const rightGroups = groups.filter(group => group.placement !== 'left');
  const leftGrouped = collectGroupedColumns(leftGroups, byKey, seen);
  const rightGrouped = collectGroupedColumns(rightGroups, byKey, seen);
  return [...leftGrouped, ...ungrouped, ...rightGrouped];
}

export function buildHeaderGroupRows(
  groups: HeaderGroupConfig[],
  columnKeys: string[],
): HeaderGroupCell[][] {
  const ancestorMap = buildAncestorMap(groups);
  const maxDepth = getHeaderGroupsMaxDepth(groups);
  if (maxDepth === 0 || columnKeys.length === 0) {
    return [];
  }

  const covered: boolean[][] = Array.from({ length: maxDepth }, () =>
    Array.from({ length: columnKeys.length }, () => false),
  );
  const rows: HeaderGroupCell[][] = Array.from({ length: maxDepth }, () => []);

  for (let level = 0; level < maxDepth; level += 1) {
    let colIndex = 0;
    while (colIndex < columnKeys.length) {
      if (covered[level][colIndex]) {
        colIndex += 1;
        continue;
      }

      const columnKey = columnKeys[colIndex];
      const ancestor = ancestorMap.get(columnKey);
      const labels = ancestor?.labels ?? [];
      const ids = ancestor?.ids ?? [];
      const label = labels[level];

      if (label !== undefined) {
        let colSpan = 1;
        while (colIndex + colSpan < columnKeys.length) {
          const nextLabels =
            ancestorMap.get(columnKeys[colIndex + colSpan])?.labels ?? [];
          const sharesPrefix = labels
            .slice(0, level + 1)
            .every((item, index) => nextLabels[index] === item);
          if (!sharesPrefix) {
            break;
          }
          colSpan += 1;
        }

        let maxPathInSpan = 0;
        for (let offset = 0; offset < colSpan; offset += 1) {
          const spanLabels =
            ancestorMap.get(columnKeys[colIndex + offset])?.labels ?? [];
          maxPathInSpan = Math.max(maxPathInSpan, spanLabels.length);
        }
        const rowSpan = maxPathInSpan === level + 1 ? maxDepth - level : 1;

        rows[level].push({
          key: `${ids[level] ?? columnKey}-${level}-${colIndex}`,
          label,
          colSpan,
          rowSpan,
          labelAlign: ancestor?.aligns[level] ?? 'center',
          isLastColumn: colIndex + colSpan >= columnKeys.length,
        });

        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
          for (let colOffset = 0; colOffset < colSpan; colOffset += 1) {
            covered[level + rowOffset][colIndex + colOffset] = true;
          }
        }
        colIndex += colSpan;
        continue;
      }

      const rowSpan = maxDepth - level;
      rows[level].push({
        key: `empty-${columnKey}-${level}`,
        label: '',
        colSpan: 1,
        rowSpan,
        isLastColumn: colIndex + 1 >= columnKeys.length,
      });
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        covered[level + rowOffset][colIndex] = true;
      }
      colIndex += 1;
    }
  }

  return rows;
}

export function hasRenderableHeaderGroups(
  groups?: HeaderGroupConfig[] | null,
): boolean {
  return Boolean(
    groups?.some(
      group =>
        Boolean(group.label) ||
        (group.columns ?? []).length > 0 ||
        hasRenderableHeaderGroups(group.children),
    ),
  );
}
