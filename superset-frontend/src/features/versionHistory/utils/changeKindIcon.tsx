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
import { ReactNode } from 'react';
import { Icons } from '@superset-ui/core/components';
import { ActivityRecord } from '../types';

/** A small kind-aware icon to lead each Version row with — adds
 * glanceability to a list of otherwise text-only rows. Open enum:
 * unknown kinds fall back to a generic edit icon rather than crashing. */
function iconForKind(kind: string, path: string[]): ReactNode {
  // Field changes on known scalar paths get a more specific icon based on
  // the leaf field name. Falls back to the generic ``field`` icon for
  // anything not in the map.
  if (kind === 'field') {
    const leaf = path[path.length - 1];
    if (leaf === 'color_scheme' || leaf === 'color_scheme_domain') {
      return <Icons.BgColorsOutlined iconSize="m" />;
    }
    if (
      leaf === 'metrics' ||
      leaf === 'groupby' ||
      leaf === 'adhoc_filters' ||
      leaf === 'filters'
    ) {
      return <Icons.FilterOutlined iconSize="m" />;
    }
    if (leaf === 'time_range') {
      return <Icons.ClockCircleOutlined iconSize="m" />;
    }
    if (
      leaf === 'json_metadata' ||
      leaf === 'css' ||
      leaf === 'params' ||
      leaf === 'query_context'
    ) {
      return <Icons.FormOutlined iconSize="m" />;
    }
    if (leaf === 'viz_type') {
      return <Icons.LineChartOutlined iconSize="m" />;
    }
    return <Icons.EditOutlined iconSize="m" />;
  }
  if (kind === 'layout') {
    return <Icons.InsertRowAboveOutlined iconSize="m" />;
  }
  if (kind === 'column') {
    return <Icons.ColumnHeightOutlined iconSize="m" />;
  }
  if (kind === 'metric') {
    return <Icons.FunctionOutlined iconSize="m" />;
  }
  if (kind === 'filter') {
    return <Icons.FilterOutlined iconSize="m" />;
  }
  if (kind === 'json') {
    return <Icons.FormOutlined iconSize="m" />;
  }
  // Open enum — anything else gets the generic edit pencil.
  return <Icons.EditOutlined iconSize="m" />;
}

/** Pick an icon to represent a save row (a transaction containing one or
 * more leaf records). Uses the first record's kind+path as the
 * representative; works well after ``rollupSelfRecords`` collapses leaves
 * with the same prefix. */
export function iconForSave(records: ActivityRecord[]): ReactNode {
  if (records.length === 0) return <Icons.EditOutlined iconSize="m" />;
  return iconForKind(records[0].kind, records[0].path);
}

/** Sum the ``impact.charts`` count across a set of records, dropping
 * nulls. Returns 0 when nothing is impacted. */
export function totalChartImpact(records: ActivityRecord[]): number {
  return records.reduce((acc, r) => acc + (r.impact?.charts ?? 0), 0);
}
