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
import { nanoid } from 'nanoid';
import {
  expandGroupColumnKey,
  getTimeComparisonColumnKeys,
  headerGroupsHaveSameColumns,
  syncTimeComparisonGroups,
  toStoredTimeComparisonColumnKey,
} from '@superset-ui/chart-controls';
import { HeaderGroupColumnOption, HeaderGroupConfig } from './types';

export { headerGroupsHaveSameColumns, syncTimeComparisonGroups };

export function createHeaderGroup(): HeaderGroupConfig {
  return {
    id: nanoid(),
    label: '',
    columns: [],
    labelAlign: 'center',
    placement: 'right',
    children: [],
  };
}

export function canSaveHeaderGroup(group: HeaderGroupConfig): boolean {
  return (
    Boolean(group.label?.trim()) &&
    (group.columns ?? []).length > 0 &&
    (group.children ?? []).every(canSaveHeaderGroup)
  );
}

export function moveHeaderGroup(
  groups: HeaderGroupConfig[],
  fromIndex: number,
  toIndex: number,
): HeaderGroupConfig[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= groups.length ||
    toIndex >= groups.length
  ) {
    return groups;
  }
  const next = [...groups];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function normalizeSelectedColumns(columns: unknown): string[] {
  return (Array.isArray(columns) ? columns : []).map(column =>
    typeof column === 'object' && column !== null && 'value' in column
      ? String((column as { value: unknown }).value)
      : String(column),
  );
}

export function collectHeaderGroupColumns(
  groups: HeaderGroupConfig[] = [],
): string[] {
  return groups.flatMap(group => [
    ...(group.columns ?? []),
    ...collectHeaderGroupColumns(group.children),
  ]);
}

function getClaimedColumnKeys(identifier: string): string[] {
  return [
    identifier,
    `%${identifier}`,
    ...getTimeComparisonColumnKeys(identifier),
  ];
}

export function collectUsedHeaderGroupColumns(
  groups: HeaderGroupConfig[] = [],
  columnOptions: HeaderGroupColumnOption[] = [],
): string[] {
  const explicit = collectHeaderGroupColumns(groups);
  const visibleKeys = new Set(columnOptions.map(option => option.value));
  const used = new Set(explicit);
  explicit.forEach(identifier => {
    getClaimedColumnKeys(identifier).forEach(key => {
      if (visibleKeys.has(key)) {
        used.add(key);
      }
    });
  });
  visibleKeys.forEach(option => {
    if (used.has(option)) {
      return;
    }
    if (getClaimedColumnKeys(option).some(key => used.has(key))) {
      used.add(option);
    }
  });
  return [...used];
}

export function updateHeaderGroupAt(
  groups: HeaderGroupConfig[],
  path: number[],
  updater: (group: HeaderGroupConfig) => HeaderGroupConfig,
): HeaderGroupConfig[] {
  if (path.length === 0) {
    return groups;
  }
  const [head, ...rest] = path;
  return groups.map((group, index) => {
    if (index !== head) {
      return group;
    }
    if (rest.length === 0) {
      return updater(group);
    }
    return {
      ...group,
      children: updateHeaderGroupAt(group.children ?? [], rest, updater),
    };
  });
}

export function moveHeaderGroupAt(
  groups: HeaderGroupConfig[],
  path: number[],
  toIndex: number,
): HeaderGroupConfig[] {
  if (path.length === 0) {
    return groups;
  }
  if (path.length === 1) {
    return moveHeaderGroup(groups, path[0], toIndex);
  }
  const parentPath = path.slice(0, -1);
  const fromIndex = path[path.length - 1];
  return updateHeaderGroupAt(groups, parentPath, group => ({
    ...group,
    children: moveHeaderGroup(group.children ?? [], fromIndex, toIndex),
  }));
}

export function removeHeaderGroupAt(
  groups: HeaderGroupConfig[],
  path: number[],
): HeaderGroupConfig[] {
  if (path.length === 0) {
    return groups;
  }
  if (path.length === 1) {
    return groups.filter((_, index) => index !== path[0]);
  }
  const [head, ...rest] = path;
  return groups.map((group, index) => {
    if (index !== head) {
      return group;
    }
    return {
      ...group,
      children: removeHeaderGroupAt(group.children ?? [], rest),
    };
  });
}

export function pruneStaleHeaderGroupColumns(
  groups: HeaderGroupConfig[],
  columnOptions: HeaderGroupColumnOption[],
): HeaderGroupConfig[] {
  const validKeys = new Set(columnOptions.map(option => option.value));
  const visibleKeys = [...validKeys];
  const resolveColumn = (column: string): string | null => {
    if (validKeys.has(column)) {
      return column;
    }
    const stored = toStoredTimeComparisonColumnKey(column, visibleKeys);
    if (stored !== column && validKeys.has(stored)) {
      return stored;
    }
    if (expandGroupColumnKey(column, visibleKeys).length > 0) {
      return column;
    }
    return null;
  };
  return groups.map(group => {
    if (group.source === 'time_compare') {
      return group;
    }
    return {
      ...group,
      columns: (group.columns ?? []).flatMap(column => {
        const resolved = resolveColumn(column);
        return resolved ? [resolved] : [];
      }),
      children: pruneStaleHeaderGroupColumns(
        group.children ?? [],
        columnOptions,
      ),
    };
  });
}
