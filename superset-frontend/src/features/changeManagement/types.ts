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

/** The asset kinds the SOW puts under review (SOW 5.1). */
export type ReviewAssetType = 'dashboard' | 'chart' | 'dataset';

/**
 * Lifecycle of a change request. The first three are *open*: the asset is
 * locked and no second request can be opened against it.
 */
export type ChangeStatus =
  | 'draft'
  | 'pending'
  | 'changes_requested'
  | 'approved'
  | 'discarded';

export interface UserBrief {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface FieldChange {
  field: string;
  /** True when the value is too large or structural to show inline. */
  opaque?: boolean;
  /** For an opaque JSON column: which entries inside it moved. */
  keys?: string[];
  /** For `position_json`: how the dashboard's layout moved, in counts. */
  layout?: { added: number; removed: number; changed: number };
  before?: string | number | boolean | null;
  after?: string | number | boolean | null;
  unchanged?: boolean;
}

export interface NamedDelta {
  name: string;
  fields?: { field: string; before: unknown; after: unknown }[];
}

export interface NamedDiff {
  added: NamedDelta[];
  changed: NamedDelta[];
  removed: NamedDelta[];
}

/**
 * Datasets are reviewed as definitions, not by rendering charts against the
 * draft (Visa Q11).
 */
export interface DatasetDetail {
  impact: { charts: number; dashboards: number };
  sql?: { before: string | null; after: string | null };
  columns?: NamedDiff;
  metrics?: NamedDiff;
}

export interface ChangeRequest {
  id: number;
  asset_type: ReviewAssetType;
  asset_id: number;
  asset_title: string | null;
  status: ChangeStatus;
  is_open: boolean;
  note: string | null;
  review_note: string | null;
  author: UserBrief | null;
  requested_approver: UserBrief | null;
  reviewer: UserBrief | null;
  created_on: string | null;
  changed_on: string | null;
  /** Version token quoted back on approve, so a stale review is refused. */
  revision?: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  /** Field names the author changed, for the "What changed" list. */
  changed_fields: string[];
  /** What each field is now and what it would become. */
  changes: FieldChange[];
  /** 'update' or 'delete'. A delete has no fields; the asset is the change. */
  operation: 'update' | 'delete';
  /**
   * Which gated command produced this request; null for the main
   * dashboard/chart/dataset update. A non-null command's `proposed` is not a
   * dashboard body and must not be previewed as one.
   */
  command?: string | null;
  /** The raw request body, laid over the live asset for the preview. */
  proposed: Record<string, unknown>;
  /** Present only for datasets. */
  dataset_detail?: DatasetDetail | null;
  /**
   * Set on a chart change when the dataset it is built on has a change of
   * its own still open. Approving the chart first publishes it against
   * columns that do not exist yet, and viewers see it break (QA-09).
   */
  pending_dependency?: PendingDependency | null;
  /** Present on the detail and per-asset endpoints, not in list rows. */
  can_approve?: boolean;
  is_author?: boolean;
  eligible_approvers?: UserBrief[];
}

/**
 * A change on another asset that this one is built on, still waiting for a
 * decision. A warning rather than a block: the chart and the dataset can be
 * held by different editors, so refusing until the dataset is decided would
 * leave neither able to proceed.
 */
export interface PendingDependency {
  asset_type: string;
  asset_id: number;
  change_request_id: number;
  status: string;
  author?: UserBrief | null;
  title?: string | null;
}

/**
 * Body of the HTTP 202 a gated write returns. The write was captured, not
 * applied: `id` is the change request's id, NOT the asset's -- callers that
 * would normally navigate to or reload "the saved thing" must use
 * `asset_id` instead.
 */
export interface ReviewRequiredResponse {
  id: number;
  ids?: number[];
  count?: number;
  asset_type?: ReviewAssetType;
  asset_id?: number;
  review_required: true;
  message?: string;
}

export function isReviewRequired(
  body: unknown,
): body is ReviewRequiredResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { review_required?: unknown }).review_required === true
  );
}

export interface PendingCount {
  /** Reviews waiting on me. Drives the bell's red number. */
  needs_me: number;
  /** My own changes that came back to me. */
  returned: number;
}

/** The four SOW list views (SOW 5.6), selected by `?show=`. */
export type ApprovalsView =
  | 'for_me'
  | 'submitted_by_me'
  | 'recently_decided'
  | 'all_pending';

/** Status labels, from the agreed copy sheet. */
export const STATUS_LABEL: Record<ChangeStatus, string> = {
  draft: 'In progress',
  pending: 'Awaiting review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  discarded: 'Discarded',
};

export function displayName(user?: UserBrief | null): string {
  if (!user) return '';
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return full || user.username || `User ${user.id}`;
}
