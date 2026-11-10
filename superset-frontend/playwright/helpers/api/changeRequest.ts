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
 * The review API (`/api/v1/change_request/...`) as the asset-approval tests
 * use it, plus the two things a governed instance makes awkward:
 * binding editors, and getting rid of a test asset afterwards.
 */
import { APIResponse, Page, expect } from '@playwright/test';
import { apiDelete, apiGet, apiPost, apiPut } from './requests';

export type ReviewAssetType = 'chart' | 'dashboard' | 'dataset';

/** Status code the gate answers a captured write with. */
export const CAPTURED = 202;

/** The statuses that hold an asset's single open slot, server-side. */
const OPEN_STATUSES = new Set(['draft', 'pending', 'changes_requested']);

export interface ChangeRequestBody {
  id: number;
  asset_type: ReviewAssetType;
  asset_id: number;
  asset_title: string | null;
  status: 'draft' | 'pending' | 'changes_requested' | string;
  operation: string;
  revision: string | null;
  changed_on: string;
  changed_fields: string[];
  is_author: boolean;
  can_approve: boolean;
  eligible_approvers: { id: number; first_name?: string; last_name?: string }[];
  proposed: Record<string, unknown>;
}

const API_ROOT: Record<ReviewAssetType, string> = {
  chart: 'api/v1/chart',
  dashboard: 'api/v1/dashboard',
  dataset: 'api/v1/dataset',
};

/**
 * Resolve people to the ids the `editors` field actually takes.
 *
 * `editors` is in the Subject id space, not the user id space, and the API
 * accepts a user id without complaint -- it just binds whatever subject
 * happens to carry that id, which on a stock instance is a *role*. The
 * asset then has no second human editor, nobody can approve anything, and
 * every maker-checker assertion fails for a reason that has nothing to do
 * with what it was testing. So the ids are always looked up by name, from
 * the same `related/editors` endpoint the picker uses.
 */
export async function editorSubjectIds(
  page: Page,
  assetType: ReviewAssetType,
  names: string[],
): Promise<number[]> {
  const res = await apiGet(page, `${API_ROOT[assetType]}/related/editors`);
  expect(res.ok(), `${assetType} editor options`).toBeTruthy();
  const options: { text: string; value: number }[] = (await res.json()).result;
  return names.map(name => {
    const match = options.find(option => option.text === name);
    expect(
      match,
      `"${name}" is offered as an editor of a ${assetType}; got ${options
        .map(o => o.text)
        .join(', ')}`,
    ).toBeTruthy();
    return (match as { value: number }).value;
  });
}

/**
 * Bind editors and read them back.
 *
 * The read-back is the point: a wrong id here is accepted with a 200 and
 * shows up much later as "nobody can approve", so the ids are confirmed
 * against the names that were asked for before any test depends on them.
 */
export async function bindEditors(
  page: Page,
  assetType: ReviewAssetType,
  assetId: number,
  names: string[],
): Promise<number[]> {
  const subjectIds = await editorSubjectIds(page, assetType, names);
  // `editors` is exempt from review (SOW 5.2), so this applies directly
  // rather than being captured as a change.
  const res = await apiPut(
    page,
    `${API_ROOT[assetType]}/${assetId}`,
    { editors: subjectIds },
    { failOnStatusCode: false },
  );
  expect(
    res.status(),
    `binding editors applies directly rather than being captured`,
  ).toBe(200);

  const readBack = await apiGet(page, `${API_ROOT[assetType]}/${assetId}`);
  const bound: { id: number; label?: string }[] =
    (await readBack.json()).result.editors ?? [];
  expect(
    bound.map(subject => subject.id).sort(),
    'the editors actually bound are the subjects that were asked for',
  ).toEqual([...subjectIds].sort());
  expect(
    bound.map(subject => subject.label).sort(),
    'the bound editors are the named people, not roles',
  ).toEqual([...names].sort());
  return subjectIds;
}

/** The asset's open change request, or null when it has none. */
export async function openChange(
  page: Page,
  assetType: ReviewAssetType,
  assetId: number,
): Promise<ChangeRequestBody | null> {
  const res = await apiGet(
    page,
    `api/v1/change_request/asset/${assetType}/${assetId}`,
    { failOnStatusCode: false },
  );
  if (!res.ok()) return null;
  const change: ChangeRequestBody | null = (await res.json()).result ?? null;
  // The endpoint answers with more than the open request. When nothing is
  // open it looks for a decision the asset's author has not seen yet and
  // returns that instead, so their own change going live is not silent. That
  // is deliberate, and it is not an open request -- a caller asking "is
  // anything open?" has to read the status, or an approved change reads as a
  // pending one for as long as the nudge window lasts.
  if (change && !OPEN_STATUSES.has(change.status)) return null;
  return change;
}

/** Wait for the asset to have an open change request, and return it. */
export async function requireOpenChange(
  page: Page,
  assetType: ReviewAssetType,
  assetId: number,
): Promise<ChangeRequestBody> {
  const change = await openChange(page, assetType, assetId);
  expect(change, `${assetType} ${assetId} has an open change request`).toBeTruthy();
  return change as ChangeRequestBody;
}

export async function submitForReview(
  page: Page,
  changeRequestId: number,
  note = 'Playwright coverage',
): Promise<APIResponse> {
  return apiPost(page, `api/v1/change_request/${changeRequestId}/submit`, {
    note,
  });
}

/**
 * Approve as whoever `approverPage` is signed in as.
 *
 * `seen_revision` is read from the request first, on purpose: the server
 * refuses an approval whose baseline has moved, and sending the revision
 * the approver is actually looking at is what that check is for.
 */
export async function approveChange(
  approverPage: Page,
  assetType: ReviewAssetType,
  assetId: number,
): Promise<APIResponse> {
  const change = await requireOpenChange(approverPage, assetType, assetId);
  return apiPost(approverPage, `api/v1/change_request/${change.id}/approve`, {
    seen_revision: change.revision ?? change.changed_on,
  });
}

export async function discardChange(
  page: Page,
  changeRequestId: number,
): Promise<APIResponse> {
  return apiPost(page, `api/v1/change_request/${changeRequestId}/discard`);
}

/**
 * Remove a governed asset for real.
 *
 * On an instance with review on, `DELETE` is captured like any other write
 * (202) -- the asset is still there and now carries a delete request
 * instead. The standard `testAssets` fixture treats that 202 as a
 * successful cleanup, so a suite that relies on it leaves its assets
 * behind. Getting rid of one therefore takes the whole workflow:
 *
 *   1. discard whatever edit is open, so the delete gets a clean slot
 *   2. make sure the approver is an editor, or there is nobody who may
 *      approve the delete -- which is the state the single-editor tests
 *      leave their asset in on purpose
 *   3. `DELETE`, which captures the delete
 *   4. submit it, and have the *other* editor approve it -- which archives
 *      the asset, because SOFT_DELETE is on
 *   5. purge the archived asset, which is not a reviewed write
 *
 * Needs both sessions for the same reason the feature does: the author
 * cannot approve their own delete.
 */
export async function removeGovernedAsset(
  authorPage: Page,
  approverPage: Page,
  assetType: ReviewAssetType,
  assetId: number,
  editorNames: string[] = ['Alex Rivera', 'Priya Shah'],
): Promise<void> {
  const root = API_ROOT[assetType];
  const detail = await apiGet(authorPage, `${root}/${assetId}`, {
    failOnStatusCode: false,
  });
  if (!detail.ok()) return; // already gone
  const { uuid } = (await detail.json()).result;

  const existing = await openChange(authorPage, assetType, assetId);
  if (existing && existing.operation !== 'delete') {
    await discardChange(authorPage, existing.id);
  }

  // Exempt from review, so it applies straight away even here.
  const subjectIds = await editorSubjectIds(authorPage, assetType, editorNames);
  await apiPut(
    authorPage,
    `${root}/${assetId}`,
    { editors: subjectIds },
    { failOnStatusCode: false },
  );

  let deleteChange = await openChange(authorPage, assetType, assetId);
  if (!deleteChange || deleteChange.operation !== 'delete') {
    await apiDelete(authorPage, `${root}/${assetId}`, {
      failOnStatusCode: false,
    });
    deleteChange = await openChange(authorPage, assetType, assetId);
  }

  if (deleteChange) {
    if (deleteChange.status === 'draft') {
      await submitForReview(authorPage, deleteChange.id, 'cleanup');
    }
    await approveChange(approverPage, assetType, assetId);
  }

  if (uuid) {
    // Purging an archived asset is not a governed write, so this is the
    // one step that actually frees the name.
    await apiPost(authorPage, `${root}/${uuid}/purge`, undefined, {
      failOnStatusCode: false,
    });
  }
}
