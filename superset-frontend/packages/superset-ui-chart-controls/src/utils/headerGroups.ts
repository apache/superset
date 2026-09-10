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
import {
  ComparisonType,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  QueryFormColumn,
  QueryFormMetric,
  QueryMode,
  SqlaFormData,
} from '@superset-ui/core';
import { isEmpty, last } from 'lodash-es';
import {
  isPercentMetric,
  isRegularMetric,
  shouldSkipMetricColumn,
} from './metricColumnFilter';

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
  columnIndex: number;
  labelAlign?: HeaderGroupLabelAlign;
  isLastColumn: boolean;
};

export const TIME_COMPARE_MAIN_KEY = 'Main';

const TIME_COMPARE_SYMBOL_PREFIXES = ['#', '△', '%'] as const;

type TimeCompareSlot = {
  metric: string;
  isMain: boolean;
  prefix: string;
};

function getMainComparisonPrefixes(): string[] {
  const translated = t('Main');
  return translated === TIME_COMPARE_MAIN_KEY
    ? [TIME_COMPARE_MAIN_KEY]
    : [translated, TIME_COMPARE_MAIN_KEY];
}

function isTimeCompareSymbolPrefix(
  prefix: string,
): prefix is (typeof TIME_COMPARE_SYMBOL_PREFIXES)[number] {
  return (TIME_COMPARE_SYMBOL_PREFIXES as readonly string[]).includes(prefix);
}

function parseTimeComparisonSlot(column: string): TimeCompareSlot | null {
  for (const prefix of TIME_COMPARE_SYMBOL_PREFIXES) {
    if (column.startsWith(`${prefix} `)) {
      return { metric: column.slice(prefix.length + 1), isMain: false, prefix };
    }
  }
  for (const prefix of getMainComparisonPrefixes()) {
    if (column.startsWith(`${prefix} `)) {
      return {
        metric: column.slice(prefix.length + 1),
        isMain: true,
        prefix: TIME_COMPARE_MAIN_KEY,
      };
    }
  }
  return null;
}

function inferMainSlotFromSiblings(
  column: string,
  visibleKeys: string[],
): TimeCompareSlot | null {
  const space = column.indexOf(' ');
  if (space <= 0) {
    return null;
  }
  const metric = column.slice(space + 1);
  if (
    !metric ||
    !TIME_COMPARE_SYMBOL_PREFIXES.some(symbol =>
      visibleKeys.includes(`${symbol} ${metric}`),
    )
  ) {
    return null;
  }
  return { metric, isMain: true, prefix: TIME_COMPARE_MAIN_KEY };
}

function resolveTimeComparisonSlotKeys(
  slot: TimeCompareSlot,
  visibleKeys: string[],
): string[] {
  if (!slot.isMain) {
    const key = `${slot.prefix} ${slot.metric}`;
    return visibleKeys.filter(item => item === key);
  }
  const wanted = new Set(
    getMainComparisonPrefixes().map(prefix => `${prefix} ${slot.metric}`),
  );
  const matches = visibleKeys.filter(key => wanted.has(key));
  if (matches.length > 0) {
    return matches;
  }
  const alternatives = visibleKeys.filter(key => {
    const space = key.indexOf(' ');
    if (space <= 0) {
      return false;
    }
    const prefix = key.slice(0, space);
    return (
      !isTimeCompareSymbolPrefix(prefix) && key.slice(space + 1) === slot.metric
    );
  });
  return alternatives.length === 1 ? alternatives : [];
}

/**
 * Locale-independent comparison column keys. `Main` is a stored slot id.
 * Chart headers display `t('Main')` and may use a translated data key.
 */
export function getTimeComparisonColumnKeys(colname: string): string[] {
  return [
    `${TIME_COMPARE_MAIN_KEY} ${colname}`,
    `# ${colname}`,
    `△ ${colname}`,
    `% ${colname}`,
  ];
}

export function toStoredTimeComparisonColumnKey(
  column: string,
  visibleKeys: string[] = [],
): string {
  const slot =
    parseTimeComparisonSlot(column) ??
    inferMainSlotFromSiblings(column, visibleKeys);
  if (!slot) {
    return column;
  }
  if (
    visibleKeys.length > 0 &&
    resolveTimeComparisonSlotKeys(slot, visibleKeys).length === 0
  ) {
    return column;
  }
  return slot.isMain
    ? `${TIME_COMPARE_MAIN_KEY} ${slot.metric}`
    : `${slot.prefix} ${slot.metric}`;
}

export function expandGroupColumnKey(
  identifier: string,
  visibleKeys: string[],
): string[] {
  const visible = new Set(visibleKeys);
  if (visible.has(identifier)) {
    return [identifier];
  }
  const slot =
    parseTimeComparisonSlot(identifier) ??
    inferMainSlotFromSiblings(identifier, visibleKeys);
  if (slot) {
    return resolveTimeComparisonSlotKeys(slot, visibleKeys);
  }
  const translatedMain = t('Main');
  const candidates = [
    `%${identifier}`,
    ...getTimeComparisonColumnKeys(identifier),
    ...(translatedMain === TIME_COMPARE_MAIN_KEY
      ? []
      : [`${translatedMain} ${identifier}`]),
  ];
  const matchSet = new Set(candidates.filter(key => visible.has(key)));
  return visibleKeys.filter(key => matchSet.has(key));
}

export function buildTimeComparisonHeaderGroups(
  metricKeys: string[],
  labelFor: (key: string) => string = key => key,
): HeaderGroupConfig[] {
  return metricKeys.map(key => ({
    id: `time-compare-${key}`,
    label: labelFor(key),
    columns: getTimeComparisonColumnKeys(key),
    labelAlign: 'left',
    placement: 'right',
    source: 'time_compare',
  }));
}

function isTimeComparisonSlotKey(column: string, prefix: string): boolean {
  return column.startsWith(`${prefix} `);
}

function remapTimeComparisonColumns(
  columns: string[],
  currentKeys: string[],
): string[] {
  const currentSet = new Set(currentKeys);
  if (columns.every(column => currentSet.has(column))) {
    return columns;
  }
  const mainKey = currentKeys.find(
    key =>
      !isTimeComparisonSlotKey(key, '#') &&
      !isTimeComparisonSlotKey(key, '△') &&
      !isTimeComparisonSlotKey(key, '%'),
  );
  const hashKey = currentKeys.find(key => isTimeComparisonSlotKey(key, '#'));
  const deltaKey = currentKeys.find(key => isTimeComparisonSlotKey(key, '△'));
  const percentKey = currentKeys.find(key => isTimeComparisonSlotKey(key, '%'));
  const remapped = columns
    .map(column => {
      if (currentSet.has(column)) {
        return column;
      }
      if (isTimeComparisonSlotKey(column, '#')) {
        return hashKey;
      }
      if (isTimeComparisonSlotKey(column, '△')) {
        return deltaKey;
      }
      if (isTimeComparisonSlotKey(column, '%')) {
        return percentKey;
      }
      return mainKey;
    })
    .filter((column): column is string => Boolean(column));
  return remapped.length > 0 ? [...new Set(remapped)] : currentKeys;
}

function refreshTimeComparisonGroup(
  group: HeaderGroupConfig,
  currentKeys: string[],
  replaceColumns: boolean,
): HeaderGroupConfig {
  return {
    ...group,
    columns: replaceColumns
      ? currentKeys
      : remapTimeComparisonColumns(group.columns ?? [], currentKeys),
    children: group.children?.map(child =>
      refreshTimeComparisonGroup(child, currentKeys, false),
    ),
  };
}

function remapUserGroupComparisonColumns(
  group: HeaderGroupConfig,
  visibleKeys: string[],
): HeaderGroupConfig {
  return {
    ...group,
    columns: (group.columns ?? []).map(column =>
      toStoredTimeComparisonColumnKey(column, visibleKeys),
    ),
    children: group.children?.map(child =>
      remapUserGroupComparisonColumns(child, visibleKeys),
    ),
  };
}

export function syncTimeComparisonGroups(
  groups: HeaderGroupConfig[],
  timeComparisonGroups: HeaderGroupConfig[] = [],
): HeaderGroupConfig[] {
  const autoById = new Map(
    timeComparisonGroups.map(group => [group.id, group]),
  );
  const existingAutoIds = new Set(
    groups
      .filter(group => group.source === 'time_compare')
      .map(group => group.id),
  );
  const comparisonKeys = timeComparisonGroups.flatMap(
    group => group.columns ?? [],
  );
  const kept = groups
    .filter(group => group.source !== 'time_compare' || autoById.has(group.id))
    .map(group => {
      if (group.source !== 'time_compare') {
        return remapUserGroupComparisonColumns(group, comparisonKeys);
      }
      const fresh = autoById.get(group.id) as HeaderGroupConfig;
      return refreshTimeComparisonGroup(group, fresh.columns, true);
    });
  const missing = timeComparisonGroups.filter(
    group => !existingAutoIds.has(group.id),
  );
  return missing.length === 0 ? kept : [...kept, ...missing];
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

function labelFromVerboseMap(
  key: string,
  verboseMap?: Record<string, string> | string[] | null,
): string {
  if (!verboseMap || Array.isArray(verboseMap)) {
    return key;
  }
  if (key.startsWith('%')) {
    const baseKey = key.replace('%', '');
    if (Object.prototype.hasOwnProperty.call(verboseMap, baseKey)) {
      return `%${verboseMap[baseKey]}`;
    }
  }
  return verboseMap[key] ?? key;
}

function columnOptionLabel(
  colname: string,
  verboseMap?: Record<string, string> | string[] | null,
): string {
  const slot = parseTimeComparisonSlot(colname);
  if (!slot) {
    return labelFromVerboseMap(colname, verboseMap);
  }
  const metricLabel = labelFromVerboseMap(slot.metric, verboseMap);
  const prefix = slot.isMain ? t('Main') : slot.prefix;
  return `${prefix} ${metricLabel}`;
}

export function resolveHeaderGroups(
  headerGroups: HeaderGroupConfig[] | undefined,
  options: {
    timeCompareEnabled: boolean;
    metricKeys: string[];
    verboseMap?: Record<string, string> | string[] | null;
  },
): HeaderGroupConfig[] {
  return syncTimeComparisonGroups(
    headerGroups ?? [],
    options.timeCompareEnabled
      ? buildTimeComparisonHeaderGroups(options.metricKeys, key =>
          labelFromVerboseMap(key, options.verboseMap),
        )
      : [],
  );
}

function splitChildGroups(group: HeaderGroupConfig): {
  left: HeaderGroupConfig[];
  right: HeaderGroupConfig[];
} {
  const children = group.children ?? [];
  return {
    left: children.filter(child => child.placement === 'left'),
    right: children.filter(child => child.placement !== 'left'),
  };
}

export function collectHeaderGroupLeaves(group: HeaderGroupConfig): string[] {
  const { left, right } = splitChildGroups(group);
  return [
    ...left.flatMap(collectHeaderGroupLeaves),
    ...(group.columns ?? []),
    ...right.flatMap(collectHeaderGroupLeaves),
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
  visibleKeys: string[],
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
      expandGroupColumnKey(column, visibleKeys).forEach(key => {
        if (!map.has(key)) {
          map.set(key, next);
        }
      });
    });
    if (group.children?.length) {
      buildAncestorMap(group.children, visibleKeys, next, map);
    }
  });
  return map;
}

function collectGroupedColumns<T extends { key: string; metricName?: string }>(
  groups: HeaderGroupConfig[],
  columns: T[],
  byKey: Map<string, T>,
  seen: Set<string>,
): T[] {
  const visibleKeys = columns.map(column => column.key);
  return groups.flatMap(collectHeaderGroupLeaves).reduce<T[]>((acc, key) => {
    const resolvedKeys = [
      ...expandGroupColumnKey(key, visibleKeys),
      ...columns
        .filter(column => column.metricName === key && !seen.has(column.key))
        .map(column => column.key),
    ];
    resolvedKeys.forEach(resolvedKey => {
      const column = byKey.get(resolvedKey);
      if (!column || seen.has(resolvedKey)) {
        return;
      }
      seen.add(resolvedKey);
      acc.push(column);
    });
    return acc;
  }, []);
}

export function orderColumnsByHeaderGroups<
  T extends { key: string; metricName?: string },
>(columns: T[], groups: HeaderGroupConfig[]): T[] {
  const visibleKeys = columns.map(column => column.key);
  const identifiers = groups.flatMap(collectHeaderGroupLeaves);
  const leafSet = new Set([
    ...identifiers.flatMap(key => expandGroupColumnKey(key, visibleKeys)),
    ...columns
      .filter(
        column => column.metricName && identifiers.includes(column.metricName),
      )
      .map(column => column.key),
  ]);
  const byKey = new Map(columns.map(column => [column.key, column]));
  const ungrouped = columns.filter(column => !leafSet.has(column.key));
  const seen = new Set<string>();
  const leftGroups = groups.filter(group => group.placement === 'left');
  const rightGroups = groups.filter(group => group.placement !== 'left');
  const leftGrouped = collectGroupedColumns(leftGroups, columns, byKey, seen);
  const rightGrouped = collectGroupedColumns(rightGroups, columns, byKey, seen);
  return [...leftGrouped, ...ungrouped, ...rightGrouped];
}

export function buildHeaderGroupRows(
  groups: HeaderGroupConfig[],
  columnKeys: string[],
): HeaderGroupCell[][] {
  const ancestorMap = buildAncestorMap(groups, columnKeys);
  const maxDepth = getHeaderGroupsMaxDepth(groups);
  if (maxDepth === 0 || columnKeys.length === 0 || ancestorMap.size === 0) {
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
          columnIndex: colIndex,
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

      rows[level].push({
        key: `empty-${columnKey}-${level}`,
        label: '',
        colSpan: 1,
        rowSpan: 1,
        columnIndex: colIndex,
        isLastColumn: colIndex + 1 >= columnKeys.length,
      });
      covered[level][colIndex] = true;
      colIndex += 1;
    }
  }

  return rows;
}

export type HeaderGroupVisibleColumn =
  | string
  | { key: string; metricName?: string };

function getVisibleColumnLookup(visible?: HeaderGroupVisibleColumn[]): {
  keys?: string[];
  metricNames: Set<string>;
} {
  if (!visible) {
    return { keys: undefined, metricNames: new Set() };
  }
  const keys: string[] = [];
  const metricNames = new Set<string>();
  visible.forEach(item => {
    if (typeof item === 'string') {
      keys.push(item);
      return;
    }
    keys.push(item.key);
    if (item.metricName) {
      metricNames.add(item.metricName);
    }
  });
  return { keys, metricNames };
}

function groupHasVisibleColumns(
  group: HeaderGroupConfig,
  visibleKeys?: string[],
  metricNames?: Set<string>,
): boolean {
  const columns = group.columns ?? [];
  if (columns.length === 0) {
    return false;
  }
  if (!visibleKeys) {
    return true;
  }
  return columns.some(
    key =>
      expandGroupColumnKey(key, visibleKeys).length > 0 ||
      Boolean(metricNames?.has(key)),
  );
}

export function hasRenderableHeaderGroups(
  groups?: HeaderGroupConfig[] | null,
  visibleColumns?: HeaderGroupVisibleColumn[],
): boolean {
  const { keys, metricNames } = getVisibleColumnLookup(visibleColumns);
  return Boolean(
    groups?.some(
      group =>
        groupHasVisibleColumns(group, keys, metricNames) ||
        hasRenderableHeaderGroups(group.children, visibleColumns),
    ),
  );
}

export function nestColDefsInHeaderGroups<
  T extends { key: string; metricName?: string },
  C,
>(
  columns: T[],
  groups: HeaderGroupConfig[],
  toColDef: (column: T) => C,
): Array<C | Record<string, unknown>> {
  const ordered = orderColumnsByHeaderGroups(columns, groups);
  const visibleKeys = ordered.map(column => column.key);
  const used = new Set<string>();

  const columnsForIdentifier = (identifier: string): T[] => {
    const resolved = new Set(expandGroupColumnKey(identifier, visibleKeys));
    return ordered.filter(
      column =>
        !used.has(column.key) &&
        (resolved.has(column.key) || column.metricName === identifier),
    );
  };

  const buildGroup = (
    group: HeaderGroupConfig,
  ): Record<string, unknown> | null => {
    const children: Array<C | Record<string, unknown>> = [];
    const { left, right } = splitChildGroups(group);
    left.forEach(child => {
      const built = buildGroup(child);
      if (built) {
        children.push(built);
      }
    });
    (group.columns ?? []).forEach(key => {
      columnsForIdentifier(key).forEach(column => {
        used.add(column.key);
        children.push(toColDef(column));
      });
    });
    right.forEach(child => {
      const built = buildGroup(child);
      if (built) {
        children.push(built);
      }
    });
    if (children.length === 0) {
      return null;
    }
    return {
      headerName: group.label,
      marryChildren: true,
      openByDefault: true,
      headerClass: `ag-header-align-${group.labelAlign ?? 'center'}`,
      children,
    };
  };

  const identifiers = groups.flatMap(collectHeaderGroupLeaves);
  const leafSet = new Set([
    ...identifiers.flatMap(key => expandGroupColumnKey(key, visibleKeys)),
    ...ordered
      .filter(
        column => column.metricName && identifiers.includes(column.metricName),
      )
      .map(column => column.key),
  ]);
  const result: Array<C | Record<string, unknown>> = [];
  groups
    .filter(group => group.placement === 'left')
    .forEach(group => {
      const built = buildGroup(group);
      if (built) {
        result.push(built);
      }
    });
  ordered.forEach(column => {
    if (!used.has(column.key) && !leafSet.has(column.key)) {
      used.add(column.key);
      result.push(toColDef(column));
    }
  });
  groups
    .filter(group => group.placement !== 'left')
    .forEach(group => {
      const built = buildGroup(group);
      if (built) {
        result.push(built);
      }
    });
  return result;
}

function getDatasourceVerboseMap(
  datasource: unknown,
): Record<string, string> | string[] {
  if (
    datasource &&
    typeof datasource === 'object' &&
    'verbose_map' in datasource
  ) {
    const verboseMap = (datasource as { verbose_map?: unknown }).verbose_map;
    if (Array.isArray(verboseMap)) {
      return verboseMap;
    }
    if (verboseMap && typeof verboseMap === 'object') {
      return verboseMap as Record<string, string>;
    }
  }
  return {};
}

type HeaderGroupsExploreControls = {
  time_compare?: { value?: unknown };
  query_mode?: { value?: unknown };
  comparison_type?: { value?: unknown };
};

export type HeaderGroupsExploreState = {
  datasource?: unknown;
  form_data?: unknown;
  controls?: HeaderGroupsExploreControls;
};

/**
 * Matches table chart transformProps: time-comparison columns are
 * emitted only in aggregate mode with comparison_type Values.
 */
export function isHeaderGroupsTimeComparisonEnabled(
  explore?: HeaderGroupsExploreState,
): boolean {
  const formData = (explore?.form_data ?? {}) as Partial<SqlaFormData>;
  const timeCompareValue =
    explore?.controls?.time_compare?.value ?? formData.time_compare;
  const queryMode = explore?.controls?.query_mode?.value ?? formData.query_mode;
  const comparisonType =
    explore?.controls?.comparison_type?.value ?? formData.comparison_type;
  return (
    !isEmpty(timeCompareValue) &&
    queryMode === QueryMode.Aggregate &&
    comparisonType === ComparisonType.Values
  );
}

export function getHeaderGroupsControlProps(
  explore?: HeaderGroupsExploreState,
  chart?: { queriesResponse?: Array<{ colnames?: string[] }> | null },
): {
  columnOptions: { value: string; label: string }[];
  timeComparisonGroups: HeaderGroupConfig[];
} {
  const verboseMap = getDatasourceVerboseMap(explore?.datasource);
  const { colnames: queryColnames } = chart?.queriesResponse?.[0] ?? {};
  const formData = (explore?.form_data ?? {}) as Partial<SqlaFormData>;
  const timeCompareValue =
    explore?.controls?.time_compare?.value ?? formData.time_compare;
  const hasTimeComparison = isHeaderGroupsTimeComparisonEnabled(explore);
  const metricKeys = [
    ...ensureIsArray(formData.metrics).map(metric =>
      getMetricLabel(metric as QueryFormMetric),
    ),
    ...ensureIsArray(formData.percent_metrics).map(
      metric => `%${getMetricLabel(metric as QueryFormMetric)}`,
    ),
  ].filter(Boolean);
  const fallbackKeys = [
    ...ensureIsArray(formData.groupby).map(col =>
      getColumnLabel(col as QueryFormColumn),
    ),
    ...ensureIsArray(formData.all_columns).map(col =>
      getColumnLabel(col as QueryFormColumn),
    ),
    ...metricKeys,
  ].filter(Boolean);
  let colnames =
    Array.isArray(queryColnames) && queryColnames.length > 0
      ? [...queryColnames]
      : [...new Set(fallbackKeys)];

  if (hasTimeComparison) {
    const sourceColnames = colnames;
    colnames = colnames.flatMap((colname: string) => {
      if (last(colname.split('__')) === timeCompareValue) {
        return [];
      }
      if (
        shouldSkipMetricColumn({
          colname,
          colnames: sourceColnames,
          formData: formData as SqlaFormData,
        })
      ) {
        return [];
      }
      if (
        isRegularMetric(colname, formData as SqlaFormData) ||
        isPercentMetric(colname, formData as SqlaFormData)
      ) {
        return [colname, ...getTimeComparisonColumnKeys(colname)];
      }
      return [colname];
    });
  }

  const columnLabel = (colname: string) =>
    columnOptionLabel(colname, verboseMap);

  return {
    columnOptions: colnames.map((colname: string) => ({
      value: colname,
      label: columnLabel(colname),
    })),
    timeComparisonGroups: hasTimeComparison
      ? buildTimeComparisonHeaderGroups(metricKeys, columnLabel)
      : [],
  };
}
