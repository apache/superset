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

export type EntityType = 'chart' | 'dashboard';

/** Entity kinds the activity endpoint can reference. Open enum on purpose:
 * the backend may surface kinds we don't render yet — unknown values should
 * fall back to a generic icon/label rather than crash. */
export type ActivityEntityKind = 'dashboard' | 'chart' | 'dataset';

/** Activity rows are either changes the viewed entity made itself
 * (``self``) or upstream changes from a different entity that this one
 * depends on (``related`` — e.g. a dataset edit that touched a chart on
 * this dashboard). */
export type ActivitySource = 'self' | 'related';

/** ``include`` query param accepted by the activity endpoint. */
export type ActivityInclude = 'self' | 'related' | 'all';

export interface Change {
  kind: string;
  path: string[];
  from_value: unknown;
  to_value: unknown;
}

export interface ChangedBy {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

/** A single row returned by ``/api/v1/{entity}/{uuid}/activity/``. Structurally
 * a superset of ``Change`` so it can flow through ``summarizeChange`` without
 * conversion. */
export interface ActivityRecord {
  version_uuid: string;
  entity_kind: ActivityEntityKind;
  entity_uuid: string | null;
  entity_name: string;
  entity_deleted: boolean;
  entity_deletion_state: 'soft_deleted' | null;
  source: ActivitySource;
  transaction_id: number;
  issued_at: string;
  changed_by: ChangedBy | null;
  // Open enum — handle unknown values defensively.
  kind: string;
  // Shape B variable depth — do NOT branch on ``path.length === N``.
  path: string[];
  from_value: unknown;
  to_value: unknown;
  // Pre-rendered summary. Always populated for ``source:'related'``; empty
  // string for ``source:'self'`` (those reconstruct from kind/path).
  summary: string;
  impact: { charts: number } | null;
}

export interface Version {
  version_uuid: string;
  version_number: number;
  transaction_id: number;
  operation_type: string;
  issued_at: string;
  changed_by: ChangedBy | null;
  changes: Change[];
}

/**
 * The ``_version`` envelope the backend nests under every snapshot. Carries
 * the same metadata as a list-row Version, but always populated (the list
 * endpoint also nests this under each row).
 */
export interface VersionMeta {
  version_uuid: string;
  version_number: number;
  transaction_id?: number;
  operation_type?: string;
  issued_at?: string;
  changed_by?: ChangedBy | null;
  changes?: Change[];
}

/**
 * Snapshot payload returned by ``/api/v1/{entity}/{uuid}/versions/{version}``.
 * Fields are loosely typed because the backend merges chart-only and
 * dashboard-only columns at the root; consumers narrow with ``in`` checks
 * (e.g. ``'params' in snapshot`` → chart payload).
 */
export interface VersionSnapshot {
  // Top-level metadata mirrored from the list row (may be omitted on the
  // single-version endpoint; consumers fall back to the matched list entry).
  version_uuid?: string;
  version_number?: number;
  transaction_id?: number;
  operation_type?: string;
  issued_at?: string;
  changed_by?: ChangedBy | null;
  changes?: Change[];

  // Dashboard scalars (merged at root by the backend).
  dashboard_title?: string | null;
  description?: string | null;
  slug?: string | null;
  css?: string | null;
  json_metadata?: string | null;
  published?: boolean | null;
  position_json?: string | Record<string, unknown> | null;
  certified_by?: string | null;
  certification_details?: string | null;

  // Chart scalars (merged at root by the backend).
  slice_name?: string;
  viz_type?: string;
  params?: string | Record<string, unknown> | null;
  query_context?: string | Record<string, unknown> | null;
  cache_timeout?: number | null;
  datasource_id?: number | null;
  datasource_type?: string | null;

  // Dashboards optionally carry the slice index; the single-version endpoint
  // for charts/dashboards does not currently emit it.
  slices?: Record<string, unknown>[] | Record<string, unknown>;

  // Columns/metrics may appear on dataset-flavored snapshots in the future.
  columns?: unknown[];
  metrics?: unknown[];

  // The nested version envelope; always present on the single-version
  // endpoint.
  _version?: VersionMeta;
}
