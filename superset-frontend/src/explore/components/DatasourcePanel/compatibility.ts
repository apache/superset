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
import { useSelector } from 'react-redux';
import { Metric } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { ExplorePageState } from 'src/explore/types';
import { DndItemType } from '../DndItemType';
import { DndItemValue } from './types';

export type CompatibleNames = string[] | null | undefined;

/**
 * An item is compatible when the corresponding list is null/undefined (no
 * filter active, e.g. SQL datasets or no selection yet) or when its name
 * explicitly appears in the list returned by the backend.
 */
export function isCompatibleItem(
  type: DndItemType,
  value: DndItemValue,
  compatibleMetrics: CompatibleNames,
  compatibleDimensions: CompatibleNames,
): boolean {
  if (type === DndItemType.Metric) {
    if (!compatibleMetrics) return true;
    return compatibleMetrics.includes((value as Metric).metric_name);
  }
  if (type === DndItemType.Column) {
    if (!compatibleDimensions) return true;
    return compatibleDimensions.includes((value as ColumnMeta).column_name);
  }
  return true;
}

/**
 * Reads the semantic-layer compatibility lists from Redux. Shared by every
 * drag source in the datasource panel so folder-level and item-level drags
 * apply the same filtering.
 */
export function useDatasourceCompatibility(): {
  compatibleMetrics: CompatibleNames;
  compatibleDimensions: CompatibleNames;
} {
  const compatibleMetrics = useSelector<ExplorePageState, CompatibleNames>(
    state => state.explore.compatibleMetrics,
  );
  const compatibleDimensions = useSelector<ExplorePageState, CompatibleNames>(
    state => state.explore.compatibleDimensions,
  );
  return { compatibleMetrics, compatibleDimensions };
}
