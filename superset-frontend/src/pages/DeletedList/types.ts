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
 * Per-type configuration for the Recently-Deleted (Archive) view. Only the
 * three archiving-capable entity types are supported in this iteration
 * (sc-111760); the view shows one type at a time, sourced from that type's
 * existing list endpoint with the `<type>_deleted_state:only` filter.
 */

export type DeletedType = 'chart' | 'dashboard' | 'dataset';

export interface DeletedTypeConfig {
  /** REST resource segment: `/api/v1/<resource>/`. */
  resource: string;
  /** The row's name field per type. */
  nameField: 'slice_name' | 'dashboard_title' | 'table_name';
  /** The rison filter operator that returns only soft-deleted rows. */
  deletedStateOperator: string;
  /** Whether the name links to a preview (charts/dashboards only). */
  previewable: boolean;
}

/** The supported types, in display order. */
export const DELETED_TYPES: DeletedType[] = ['chart', 'dashboard', 'dataset'];

export const DELETED_TYPE_CONFIG: Record<DeletedType, DeletedTypeConfig> = {
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

/** A normalized row in the Recently-Deleted table (per-type projection). */
export interface DeletedItem {
  id: number;
  uuid: string;
  changed_by?: { first_name?: string; last_name?: string; id?: number } | null;
  deleted_at?: string | null;
  [key: string]: unknown;
}
