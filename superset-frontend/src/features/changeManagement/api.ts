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
import { SupersetClient } from '@superset-ui/core';
import type {
  ApprovalsView,
  ChangeRequest,
  ChangeStatus,
  PendingCount,
  ReviewAssetType,
  UserBrief,
} from './types';

const BASE = '/api/v1/change_request';

/**
 * The open change request on an asset, or null when there is none.
 *
 * Null is the normal answer, not an error: most assets most of the time
 * have nothing pending. It is also what a viewer gets even when something
 * *is* pending, because viewers see no workflow UI at all (SOW 5.5).
 */
export async function fetchForAsset(
  assetType: ReviewAssetType,
  assetId: number,
): Promise<ChangeRequest | null> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}/asset/${assetType}/${assetId}`,
  });
  return (json?.result as ChangeRequest | null) ?? null;
}

export async function fetchChangeRequest(id: number): Promise<ChangeRequest> {
  const { json } = await SupersetClient.get({ endpoint: `${BASE}/${id}` });
  return json.result as ChangeRequest;
}

export async function fetchList(
  show: ApprovalsView = 'for_me',
): Promise<ChangeRequest[]> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}/?show=${show}`,
  });
  return (json?.result as ChangeRequest[]) ?? [];
}

/**
 * Every open change on one asset kind, keyed by asset id.
 *
 * For list pages: one request decorates the whole page, where asking
 * per-row would turn a list into fifty requests.
 */
export async function fetchOpenByAsset(
  assetType: ReviewAssetType,
): Promise<Record<string, ChangeStatus>> {
  const { json } = await SupersetClient.get({
    endpoint: `${BASE}/open/${assetType}`,
  });
  return (json?.result as Record<string, ChangeStatus>) ?? {};
}

/** The bell's red number. Hidden at zero (Decision 9). */
export async function fetchPendingCount(): Promise<PendingCount> {
  const { json } = await SupersetClient.get({ endpoint: `${BASE}/count` });
  return (json?.result as PendingCount) ?? { needs_me: 0, returned: 0 };
}

async function act(
  id: number,
  action: string,
  body: Record<string, unknown> = {},
): Promise<ChangeRequest | null> {
  const { json } = await SupersetClient.post({
    endpoint: `${BASE}/${id}/${action}`,
    jsonPayload: body,
  });
  return (json?.result as ChangeRequest | null) ?? null;
}

export const submitForReview = (
  id: number,
  note?: string,
  requestedApproverId?: number | null,
) =>
  act(id, 'submit', {
    note,
    requested_approver_id: requestedApproverId ?? null,
  });

export const approveChange = (
  id: number,
  note?: string,
  seenRevision?: string | null,
) =>
  // `seen_revision` is the version of the request this reviewer was shown.
  // The author can save again while the review is open, and without this
  // the Approve would publish the new text unread (129070).
  act(id, 'approve', { note, seen_revision: seenRevision ?? null });

/**
 * Send the change back to its author. The note is required: the behaviour is
 * unchanged from "Reject", but the work goes back rather than being killed,
 * and sending it back without saying why is what makes that useless
 * (Decision 3).
 */
export const requestChanges = (id: number, reviewNote: string) =>
  act(id, 'request_changes', { review_note: reviewNote });

export const withdrawRequest = (id: number) => act(id, 'withdraw');

export const discardChange = (id: number) => act(id, 'discard');

/**
 * Ask for a draft dashboard to go live.
 *
 * Publishing is an ordinary dashboard update as far as Superset is
 * concerned, which is exactly why it routes through the same gate: the
 * server captures it like any other governed write and answers 202.
 */
export const requestPublish = (dashboardId: number) =>
  SupersetClient.put({
    endpoint: `/api/v1/dashboard/${dashboardId}`,
    jsonPayload: { published: true },
  });

/**
 * Who could be made an editor of this asset, and who already is.
 *
 * SOW 5.4 tells an author with no eligible approver to add another editor
 * so they can submit, which only works if they can do it from where they
 * are told about it. SOW 5.2 exempts the editors list from review, so the
 * change applies immediately rather than needing the approval they are
 * trying to make possible.
 */
export const fetchEditorOptions = async (
  assetType: ReviewAssetType,
): Promise<UserBrief[]> => {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/${assetType}/related/editors?q=(page_size:100)`,
  });
  return ((json?.result as Record<string, unknown>[]) ?? []).map(row => ({
    id: row.value as number,
    first_name: row.text as string,
    last_name: '',
    username: ((row.extra as Record<string, unknown>)?.secondary_label ??
      '') as string,
  })) as UserBrief[];
};

export const fetchAssetEditorIds = async (
  assetType: ReviewAssetType,
  assetId: number,
): Promise<number[]> => {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/${assetType}/${assetId}`,
  });
  const editors = ((json?.result as Record<string, unknown>)?.editors ??
    []) as { id: number }[];
  return editors.map(editor => editor.id);
};

export const saveEditors = (
  assetType: ReviewAssetType,
  assetId: number,
  editorIds: number[],
) =>
  SupersetClient.put({
    endpoint: `/api/v1/${assetType}/${assetId}`,
    jsonPayload: { editors: editorIds },
  });
