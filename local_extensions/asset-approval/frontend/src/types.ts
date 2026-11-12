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
  /** How many are waiting; the named one is the oldest of them. */
  count?: number;
}

export interface UserBrief {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/** One line in the list of what moved inside a structured field. */
export interface EntryChange {
  kind: 'added' | 'removed' | 'changed';
  /** The setting, filter, dashboard or member this line is about. */
  key: string;
  before?: string | null;
  after?: string | null;
  /** The value was cut to fit; the whole of it is on the asset. */
  truncated?: boolean;
  /**
   * Superset recalculated this because of another change in the same save
   * (a filter's list of charts in scope after a chart was deleted). Shown
   * under the field's `consequence_summary`, behind a toggle, never dropped.
   */
  consequence?: boolean;
  /**
   * The save wrote this setting down for the first time, at the value it
   * already had. A first save of a chart carries dozens of these. Grouped
   * behind a toggle, never dropped.
   *
   * `api.py` has set it the whole time, so the field was arriving and
   * nothing here admitted it existed.
   */
  first_time?: boolean;
}

/** A dashboard layout component that arrived, left or changed. */
export interface LayoutComponent {
  kind: 'added' | 'removed' | 'changed';
  /** The layout's own type: CHART, HEADER, MARKDOWN, TAB, DIVIDER... */
  type: string;
  /** What the author calls it: the chart's name, the heading's text. */
  name?: string;
  moved?: boolean;
  details?: string[];
}

export interface FieldChange {
  field: string;
  /**
   * A keyword the write was called with (`delete_metric_ids`,
   * `save_to_dashboard_id`, ...) and not a field of the asset. `summary`
   * says what approving does because of it; `after` is its value.
   */
  keyword?: boolean;
  /** What approving does because of this, in a sentence. */
  summary?: string;
  /** For a keyword naming a dashboard: whether that dashboard is published. */
  published?: boolean | null;
  /**
   * The request as it was captured, shown because there was nothing else to
   * show: a request with no changed field, keyword or dataset row. `after`
   * holds it.
   */
  unreadable?: boolean;
  /**
   * The value is not a scalar (an object, a list, a layout). Informational:
   * what to draw is decided by which of `layout`, `entries`, `keys`,
   * `before` and `after` the server sent, not by this flag.
   */
  opaque?: boolean;
  /** The shown value was shortened. It is never dropped: a reviewer who
   * cannot see what they are approving is the thing this feature exists
   * to prevent. */
  truncated?: boolean;
  /** For a JSON column: which top-level entries inside it moved. */
  keys?: string[];
  /**
   * For a layout: which components moved. `added`, `removed` and `changed`
   * count the layout's elements whose JSON differs, containers included, so
   * they do not add up to `components`. The panel does not display them; its
   * header is counted from `components`.
   */
  layout?: {
    added: number;
    removed: number;
    changed: number;
    components?: LayoutComponent[];
    more?: number;
  };
  /**
   * What moved inside the field, with each value before and after. Walks
   * nested objects, tells a filter removed from a filter added, and for a
   * collection (viewers, dashboards, tags) lists who joined and who left.
   */
  entries?: EntryChange[];
  /**
   * One sentence saying why the entries flagged `consequence` changed:
   * "Cross-filter scopes updated for 3 removed charts (A, B, C)".
   */
  consequence_summary?: string;
  /**
   * Entries the server did not send. The server sends every entry, so this
   * is never set by it; a client that meets it says so rather than reading
   * a partial list as the whole change.
   */
  more?: number;
  /** For a collection: how many members each side holds. */
  count?: { before: number; after: number };
  /** For a version restore: when that version was saved, and by whom. */
  saved_at?: string;
  saved_by?: string;
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
  /**
   * Every other field the change moves: the description riding with a
   * governed edit, `main_dttm_col`, `fetch_values_predicate`,
   * `template_params`, `extra.warning_markdown`. The dialog had three tabs
   * and the server emitted three fields, so these were replayed on approve
   * and shown nowhere -- a reviewer read "No column changed." and approved
   * them unseen (129075).
   */
  settings?: FieldChange[];
}

export interface ChangeRequest {
  id: number;
  asset_type: ReviewAssetType;
  asset_id: number;
  asset_title: string | null;
  /**
   * The asset is archived, so it has no page to review it on. The server
   * loads the asset already and so knows; inferring it from `command`
   * covered restores alone and sent reviewers to dead pages for everything
   * else (R3-01).
   */
  asset_archived?: boolean;
  /**
   * The author still holds edit access to the asset. Approving is refused
   * with 409 once they do not, while `can_approve` stays true by decision,
   * so the row has to say so before the button is pressed (QA-07).
   */
  author_can_still_edit?: boolean;
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
  /**
   * Why there is nothing here to approve, when there is not: the request has
   * no changed field, keyword or dataset row to read. Approve must not be
   * offered while this is set; the server refuses it too.
   */
  review_blocked?: string | null;
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
  /** Present on the detail and per-asset endpoints, not in list rows. */
  /**
   * A change on the asset this one is built on, still waiting for a
   * decision: a chart under a dashboard, a dataset under a chart. The
   * server has sent it the whole time.
   */
  pending_dependency?: PendingDependency | null;
  can_approve?: boolean;
  is_author?: boolean;
  eligible_approvers?: UserBrief[];
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
