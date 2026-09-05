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
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  QueryFormColumn,
  QueryFormMetric,
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

export function getTimeComparisonColumnKeys(colname: string): string[] {
  return [
    `${t('Main')} ${colname}`,
    `# ${colname}`,
    `△ ${colname}`,
    `% ${colname}`,
  ];
}

export function expandGroupColumnKey(
  identifier: string,
  visibleKeys: string[],
): string[] {
  const visible = new Set(visibleKeys);
  const candidates = [
    identifier,
    `%${identifier}`,
    ...getTimeComparisonColumnKeys(identifier),
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
    labelAlign: 'center',
    placement: 'right',
    source: 'time_compare',
  }));
}

export function syncTimeComparisonGroups(
  groups: HeaderGroupConfig[],
  timeComparisonGroups: HeaderGroupConfig[] = [],
): HeaderGroupConfig[] {
  const autoIds = new Set(timeComparisonGroups.map(group => group.id));
  const existingAutoIds = new Set(
    groups
      .filter(group => group.source === 'time_compare')
      .map(group => group.id),
  );
  const kept = groups.filter(
    group => group.source !== 'time_compare' || autoIds.has(group.id),
  );
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

export function resolveHeaderGroups(
  headerGroups: HeaderGroupConfig[] | undefined,
  options: {
    timeCompareEnabled: boolean;
    metricKeys: string[];
    verboseMap?: Record<string, string> | string[] | null;
  },
): HeaderGroupConfig[] {
  const labelFor = (key: string) =>
    options.verboseMap &&
    !Array.isArray(options.verboseMap) &&
    options.verboseMap[key]
      ? options.verboseMap[key]
      : key;
  return syncTimeComparisonGroups(
    headerGroups ?? [],
    options.timeCompareEnabled
      ? buildTimeComparisonHeaderGroups(options.metricKeys, labelFor)
      : [],
  );
}

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
    (group.children ?? []).forEach(child => {
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

export function getHeaderGroupsControlProps(
  explore?: {
    datasource?: unknown;
    form_data?: unknown;
    controls?: { time_compare?: { value?: unknown } };
  },
  chart?: { queriesResponse?: Array<{ colnames?: string[] }> },
): {
  columnOptions: { value: string; label: string }[];
  timeComparisonGroups: HeaderGroupConfig[];
} {
  const verboseMap = getDatasourceVerboseMap(explore?.datasource);
  const { colnames: queryColnames } = chart?.queriesResponse?.[0] ?? {};
  const formData = (explore?.form_data ?? {}) as Partial<SqlaFormData>;
  const timeCompareValue = explore?.controls?.time_compare?.value;
  const hasTimeComparison = !isEmpty(timeCompareValue);
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
        return getTimeComparisonColumnKeys(colname);
      }
      return [colname];
    });
  }

  const columnLabel = (colname: string) =>
    Array.isArray(verboseMap) ? colname : (verboseMap?.[colname] ?? colname);

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
