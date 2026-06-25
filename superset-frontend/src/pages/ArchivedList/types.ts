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

/**
 * Per-type configuration for the Archive (Recently-Archived) view. Only the
 * three archiving-capable entity types are supported in this iteration
 * (sc-111760); the view shows one type at a time, sourced from that type's
 * existing list endpoint with the soft-delete `<type>_deleted_state:only`
 * filter. (The backend soft-delete contract — the `*_deleted_state` operators
 * and the `deleted_at` column — keeps its original naming; only the
 * user-facing terminology is "archived".)
 */

export type ArchivedType = 'chart' | 'dashboard' | 'dataset';

export interface ArchivedTypeConfig {
  /** REST resource segment: `/api/v1/<resource>/`. */
  resource: string;
  /** The row's name field per type. */
  nameField: 'slice_name' | 'dashboard_title' | 'table_name';
  /** The rison filter operator that returns only soft-deleted (archived) rows. */
  deletedStateOperator: string;
  /** Whether the name links to a preview (charts/dashboards only). */
  previewable: boolean;
}

/** The supported types, in display order. */
export const ARCHIVED_TYPES: ArchivedType[] = ['chart', 'dashboard', 'dataset'];

export const ARCHIVED_TYPE_CONFIG: Record<ArchivedType, ArchivedTypeConfig> = {
  chart: {
    resource: 'chart',
    nameField: 'slice_name',
    deletedStateOperator: 'chart_deleted_state',
    previewable: true,
  },
  dashboard: {
    resource: 'dashboard',
    nameField: 'dashboard_title',
    deletedStateOperator: 'dashboard_deleted_state',
    previewable: true,
  },
  dataset: {
    resource: 'dataset',
    nameField: 'table_name',
    deletedStateOperator: 'dataset_deleted_state',
    previewable: false,
  },
};

/** A normalized row in the Archive table (per-type projection). */
export interface ArchivedItem {
  id: number;
  uuid: string;
  changed_by?: { first_name?: string; last_name?: string; id?: number } | null;
  deleted_at?: string | null;
  /** Link to the asset, used by the recovery toast (charts/dashboards). */
  url?: string | null;
  /** Dataset link target, used by the recovery toast. */
  explore_url?: string | null;
  // The per-type name field (slice_name / dashboard_title / table_name) is read
  // dynamically via the type config, so the index signature remains.
  [key: string]: unknown;
}
