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
import {
  getActiveAdhocFilters,
  getActiveResolvedFilters,
  toAdhocFilters,
} from '@apache-superset/widgets/activeFilters';
import type { ResolvedFilter } from '@apache-superset/core/widgets';
import type DashboardProvider from './DashboardProvider';
import { isContainerType } from './DashboardProvider';

export { toAdhocFilters };

export const FILTER_TYPE_PREFIX = 'filter.';

/** A filter type that resolves to a value, as opposed to `filter.bar`, which only arranges filters. */
export function isLeafFilterType(type: string): boolean {
  return type.startsWith(FILTER_TYPE_PREFIX) && !isContainerType(type);
}

/** The resolved filters other nodes (or the host) currently apply to `consumerNodeId`. */
export const getActiveResolvedFiltersForDataset = (
  store: DashboardProvider,
  datasetId: number,
  consumerNodeId: string,
): ResolvedFilter[] =>
  getActiveResolvedFilters(store, datasetId, consumerNodeId);

export const getActiveFiltersForDataset = (
  store: DashboardProvider,
  datasetId: number,
  consumerNodeId: string,
): Record<string, unknown>[] =>
  getActiveAdhocFilters(store, datasetId, consumerNodeId);
