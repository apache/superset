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
import { HeaderGroupColumnOption, HeaderGroupConfig } from './types';

export function createHeaderGroup(): HeaderGroupConfig {
  return {
    id: nanoid(),
    label: '',
    columns: [],
    labelAlign: 'center',
    children: [],
  };
}

export function collectHeaderGroupColumns(
  groups: HeaderGroupConfig[] = [],
): string[] {
  return groups.flatMap(group => [
    ...(group.columns ?? []),
    ...collectHeaderGroupColumns(group.children),
  ]);
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
  return groups.map(group => ({
    ...group,
    columns: (group.columns ?? []).filter(column => validKeys.has(column)),
    children: pruneStaleHeaderGroupColumns(group.children ?? [], columnOptions),
  }));
}

export function headerGroupsHaveSameColumns(
  left: HeaderGroupConfig[],
  right: HeaderGroupConfig[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((group, index) => {
    const other = right[index];
    if (
      group.id !== other.id ||
      group.columns.length !== other.columns.length ||
      group.columns.some(
        (column, colIndex) => column !== other.columns[colIndex],
      )
    ) {
      return false;
    }
    return headerGroupsHaveSameColumns(
      group.children ?? [],
      other.children ?? [],
    );
  });
}
