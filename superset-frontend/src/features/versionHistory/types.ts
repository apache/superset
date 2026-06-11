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

export type VersionedEntityType = 'chart' | 'dashboard';

export type ActivityInclude = 'self' | 'related' | 'all';

export type ActivityEntityKind = 'chart' | 'dashboard' | 'dataset';

export type ActivityOperation = 'add' | 'remove' | 'move' | 'edit';

export type ActivityActionKind = 'restore' | 'import' | 'clone' | null;

export interface ActivityChangedBy {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

export interface ActivityRecord {
  version_uuid: string | null;
  entity_kind: ActivityEntityKind;
  entity_uuid: string | null;
  entity_name: string;
  entity_deleted: boolean;
  entity_deletion_state: string | null;
  source: 'self' | 'related';
  transaction_id: number;
  action_kind: ActivityActionKind;
  issued_at: string;
  changed_by: ActivityChangedBy | null;
  kind: string;
  operation: ActivityOperation;
  path: Array<string | number>;
  from_value: unknown;
  to_value: unknown;
  summary: string;
  impact: { charts: number } | null;
}

export interface ActivityResponse {
  result: ActivityRecord[];
  count: number;
}

export interface VersionChangedBy extends ActivityChangedBy {
  username: string | null;
}

export interface VersionMeta {
  version_uuid: string;
  version_number: number;
  transaction_id: number;
  operation_type: 'baseline' | 'update' | 'delete';
  issued_at: string;
  changed_by: VersionChangedBy | null;
  changes: Array<{
    kind: string;
    operation: ActivityOperation;
    path: Array<string | number>;
    from_value: unknown;
    to_value: unknown;
  }>;
}

export interface ChartVersionSnapshot {
  slice_name: string;
  params: string | null;
  viz_type: string;
  query_context: string | null;
  description: string | null;
  cache_timeout: number | null;
  datasource_id: number;
  datasource_type: string;
  uuid: string;
  _version: VersionMeta;
  [key: string]: unknown;
}

export interface DashboardVersionSnapshot {
  dashboard_title: string;
  position_json: string | null;
  json_metadata: string | null;
  css: string | null;
  slug: string | null;
  certified_by: string | null;
  uuid: string;
  _version: VersionMeta;
  [key: string]: unknown;
}

export type VersionSnapshot = ChartVersionSnapshot | DashboardVersionSnapshot;

/**
 * A group of `source='self'` activity records that belong to one save
 * (one version transaction).
 */
export interface SaveGroup {
  type: 'group';
  transactionId: number;
  versionUuid: string | null;
  issuedAt: string;
  changedBy: ActivityChangedBy | null;
  actionKind: ActivityActionKind;
  records: ActivityRecord[];
}

/** A standalone `source='related'` activity record. */
export interface RelatedEntry {
  type: 'related';
  record: ActivityRecord;
}

export type TimelineEntry = SaveGroup | RelatedEntry;

export type DashboardGroupCategory = 'filters' | 'edit';

/** State describing the version currently being previewed, if any. */
export interface VersionPreviewState {
  entityUuid: string;
  versionUuid: string;
  transactionId: number;
  headline: string;
  issuedAt: string;
}

/** One unsaved-change entry shown in the "Current version" section. */
export interface SessionLogEntry {
  label: string;
  controlName: string;
  ts: number;
  user: string | null;
}

export interface VersionHistoryState {
  isPanelOpen: boolean;
  entityType: VersionedEntityType | null;
  include: ActivityInclude;
  preview: VersionPreviewState | null;
  sessionLog: SessionLogEntry[];
}
