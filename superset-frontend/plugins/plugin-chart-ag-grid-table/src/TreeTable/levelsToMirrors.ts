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
import { QueryFormMetric } from '@superset-ui/core';
import { TreeLevel, TreeMirrors } from './types';

function dedupe<T>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rowColumns(level: TreeLevel): string[] {
  return dedupe(
    [
      level.id_column,
      level.parent_column,
      ...(level.columns ?? []),
      ...(level.detail_fields ?? []),
    ].filter((column): column is string => Boolean(column)),
  );
}

export function sortableColumns(level: TreeLevel): string[] {
  return dedupe([level.id_column, ...(level.columns ?? [])].filter(Boolean));
}

export function defaultSort(level: TreeLevel): [string, boolean] {
  return level.sort ?? [level.id_column, true];
}

export function countMetric(level: TreeLevel): QueryFormMetric {
  return {
    expressionType: 'SIMPLE',
    aggregate: 'COUNT_DISTINCT',
    column: { column_name: level.id_column },
    label: `COUNT_DISTINCT(${level.id_column})`,
  };
}

export default function levelsToMirrors(levels: TreeLevel[]): TreeMirrors {
  const columns: string[] = [];
  const metrics: QueryFormMetric[] = [];
  const orderby: [string, boolean][] = [];
  levels.forEach((level, index) => {
    if (!level.id_column) return;
    columns.push(...rowColumns(level));
    const sortable = sortableColumns(level);
    if (index > 0) {
      metrics.push(countMetric(level));
      if (level.parent_column) sortable.push(level.parent_column);
    }
    sortable.forEach(column => {
      orderby.push([column, true], [column, false]);
    });
  });
  return {
    tree_columns: dedupe(columns),
    tree_metrics: dedupe(metrics),
    tree_orderby: dedupe(orderby),
  };
}
