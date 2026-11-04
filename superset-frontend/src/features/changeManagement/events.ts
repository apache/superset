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
import type { JsonObject } from '@superset-ui/core';
import { reviewLog } from './log';

/**
 * A one-hop signal from an asset's edit header to its review banner.
 *
 * The two live far apart in the tree -- the dashboard header is inside
 * DashboardBuilder's header, the banner is a sibling of its content -- and
 * threading a callback between them would mean adding props to several
 * components that have nothing to do with review. A scoped event keeps the
 * coupling to one named string.
 *
 * Deliberately not a store: there is no state here, only "the author just
 * asked to request review, and the banner should open its modal once it has
 * loaded the change that save produced".
 */
export const REQUEST_REVIEW_EVENT = 'superset:change-management:request-review';

export interface RequestReviewDetail {
  /**
   * Whether the click that asked for this also started a save.
   *
   * The banner's Request review acts on a draft that is already stored, so
   * there is nothing to wait for. The edit toolbar's saves first, and the
   * draft the dialog is about does not exist yet when this is announced.
   *
   * Without the distinction the listener could only wait for "a draft
   * exists", which is already true whenever the author is editing on top
   * of one -- so the dialog opened on the *previous* draft while the save
   * replacing it was still in flight. Measured at 70ms before the save
   * returned, which is long enough to submit the wrong thing.
   */
  savingFirst: boolean;
}

export function announceRequestReview(
  detail: RequestReviewDetail = { savingFirst: false },
): void {
  reviewLog('event: request review asked for', {
    savingFirst: detail.savingFirst,
  });
  window.dispatchEvent(new CustomEvent(REQUEST_REVIEW_EVENT, { detail }));
}

export function onRequestReview(
  handler: (detail: RequestReviewDetail) => void,
): () => void {
  const listener = (event: Event) => {
    // An event dispatched without a detail -- a test, or an older caller --
    // reads as "nothing to wait for", which is the behaviour this had
    // before the field existed.
    const { detail } = event as CustomEvent<RequestReviewDetail | undefined>;
    handler({ savingFirst: detail?.savingFirst ?? false });
  };
  window.addEventListener(REQUEST_REVIEW_EVENT, listener);
  return () => window.removeEventListener(REQUEST_REVIEW_EVENT, listener);
}

/**
 * A write was captured for review (the server answered 202).
 *
 * The author stays on the page they saved from, and nothing on it knows the
 * save became a draft: the banner and the Request review button are drawn
 * from a change request fetched when the page loaded, which at that point
 * did not exist. The page therefore showed the live version with no way to
 * submit until a manual reload (129074). The save paths announce here and
 * the review component re-reads, so the next action is on screen the moment
 * the save lands.
 */
export const CHANGE_CAPTURED_EVENT =
  'superset:change-management:change-captured';

export function announceChangeCaptured(): void {
  reviewLog('event: a write was captured for review');
  window.dispatchEvent(new CustomEvent(CHANGE_CAPTURED_EVENT));
}

export function onChangeCaptured(handler: () => void): () => void {
  window.addEventListener(CHANGE_CAPTURED_EVENT, handler);
  return () => window.removeEventListener(CHANGE_CAPTURED_EVENT, handler);
}

/**
 * A request moved through the workflow: submitted, withdrawn, returned,
 * approved or discarded.
 *
 * Separate from the captured event, which means "a write was held and the
 * asset now has a request it did not have". This one means "the request's
 * status moved", and the two have different consequences: a capture also
 * puts the live asset back on screen, and a transition must not.
 *
 * It exists because the status had two readers and only one of them was
 * told. The banner re-read after its own actions; the edit toolbar, on a
 * separate hook, did not. So a change that was with a reviewer still
 * offered "Request review" in the toolbar, enabled, described in its
 * tooltip as "your saved draft", and clicking it did nothing at all --
 * the dialog it fires only opens for a draft. One fact, two sources, and
 * the one the author was looking at was the stale one.
 */
export const REVIEW_CHANGED_EVENT =
  'superset:change-management:review-changed';

export function announceReviewChanged(): void {
  reviewLog('event: review status moved');
  window.dispatchEvent(new CustomEvent(REVIEW_CHANGED_EVENT));
}

export function onReviewChanged(handler: () => void): () => void {
  window.addEventListener(REVIEW_CHANGED_EVENT, handler);
  return () => window.removeEventListener(REVIEW_CHANGED_EVENT, handler);
}

/**
 * The author pressed Edit while their own change is with a reviewer.
 *
 * Editing it has to take it off the approvers' queue first, and the author
 * cannot see that queue: to them the asset simply becomes editable again,
 * while the approver who had set time aside for it is the one who notices.
 * So it is confirmed, by name, before anything moves.
 *
 * The banner has always done this. The dashboard's own Edit button did not
 * -- it went straight into edit mode, left the request sitting in the
 * reviewer's queue, and took it out silently at save time instead. Two
 * buttons, both labelled Edit, one telling the author what it was about to
 * do and the other doing it behind them. This is how the header asks for
 * the same dialog, since only the review component knows who the approvers
 * are.
 */
export const WITHDRAW_TO_EDIT_EVENT =
  'superset:change-management:withdraw-to-edit';

export function announceWithdrawToEdit(): void {
  reviewLog('event: edit asked for on a change that is with a reviewer');
  window.dispatchEvent(new CustomEvent(WITHDRAW_TO_EDIT_EVENT));
}

export function onWithdrawToEdit(handler: () => void): () => void {
  window.addEventListener(WITHDRAW_TO_EDIT_EVENT, handler);
  return () => window.removeEventListener(WITHDRAW_TO_EDIT_EVENT, handler);
}

/**
 * The withdrawal went through, so now do the editing part of it.
 *
 * The dialog's button reads "Withdraw and edit" and it only ever withdrew.
 * The author confirmed an edit, watched the request leave review, and was
 * left on the same read-only page with a toast -- having to press Edit a
 * second time to get what the first press had promised.
 *
 * Announced rather than done directly because edit mode belongs to the
 * host: the review component has no business reaching into a dashboard's
 * store, and on a chart or a dataset there is no edit mode for it to reach
 * into, so nothing is listening and nothing happens.
 */
export const EDIT_AFTER_WITHDRAW_EVENT =
  'superset:change-management:edit-after-withdraw';

export function announceEditAfterWithdraw(): void {
  reviewLog('event: withdrawn, now entering edit mode');
  window.dispatchEvent(new CustomEvent(EDIT_AFTER_WITHDRAW_EVENT));
}

export function onEditAfterWithdraw(handler: () => void): () => void {
  window.addEventListener(EDIT_AFTER_WITHDRAW_EVENT, handler);
  return () => window.removeEventListener(EDIT_AFTER_WITHDRAW_EVENT, handler);
}

/**
 * An editor tried to edit an asset somebody else already has open.
 *
 * Same one-hop shape as the request-review signal, and for the same reason:
 * the edit button is in the asset's header and the explanation belongs to
 * the review component, which is the only thing that knows whose change it
 * is and how old it is (SOW 5.3).
 */
export const ASSET_LOCKED_EVENT = 'superset:change-management:asset-locked';

export function announceAssetLocked(): void {
  reviewLog('event: asset locked by another editor');
  window.dispatchEvent(new CustomEvent(ASSET_LOCKED_EVENT));
}

export function onAssetLocked(handler: () => void): () => void {
  window.addEventListener(ASSET_LOCKED_EVENT, handler);
  return () => window.removeEventListener(ASSET_LOCKED_EVENT, handler);
}

/**
 * The ⋯ menu's review entries (mock 1c).
 *
 * The menu is built by the dashboard header and knows nothing about the
 * open change; these let it offer the two review actions without taking
 * the workflow's state as a dependency.
 */
export const SHOW_WHAT_CHANGED_EVENT =
  'superset:change-management:show-what-changed';

export function announceShowWhatChanged(): void {
  reviewLog('event: what changed asked for');
  window.dispatchEvent(new CustomEvent(SHOW_WHAT_CHANGED_EVENT));
}

export function onShowWhatChanged(handler: () => void): () => void {
  window.addEventListener(SHOW_WHAT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SHOW_WHAT_CHANGED_EVENT, handler);
}

export const DISCARD_CHANGES_EVENT = 'superset:change-management:discard';

export function announceDiscardChanges(): void {
  reviewLog('event: discard asked for');
  window.dispatchEvent(new CustomEvent(DISCARD_CHANGES_EVENT));
}

export function onDiscardChanges(handler: () => void): () => void {
  window.addEventListener(DISCARD_CHANGES_EVENT, handler);
  return () => window.removeEventListener(DISCARD_CHANGES_EVENT, handler);
}

/**
 * What Explore should show in the chart column, and what to call it.
 *
 * Three states, not two. ``previewable`` false means no chart change is
 * open, or the one that is open does not change the drawing, so Explore
 * says nothing at all. ``previewable`` true with no form data is the live
 * chart, labelled as the live chart -- the state that used to be silent,
 * which is how a reviewer could look at the old chart and approve without
 * anything on screen contradicting them. With form data it is the
 * proposal.
 *
 * Same one-hop shape as the signals above, and for the same reason: the
 * switch belongs to the review banner, which is mounted inside Explore's
 * content column, while the thing that has to be swapped is the chart
 * panel beside it.
 *
 * The dashboard half of this feature re-hydrates the page instead, because
 * a dashboard proposal is a layout and a dashboard already knows how to
 * draw one. A chart proposal is a set of controls, and Explore's controls
 * are the author's working copy rather than a renderer, so the proposal is
 * drawn beside them instead of written into them.
 */
export interface ProposedChartState {
  /** Whether this page has a chart change whose drawing can be previewed. */
  previewable: boolean;
  /** The proposed chart, or null while the live one is on screen. */
  formData: JsonObject | null;
  /**
   * A change still open on the dataset this chart is built on, if any. The
   * preview queries the *live* dataset, so a proposal written against
   * columns that are themselves awaiting review will fail or mislead, and
   * the reviewer needs to be told which of the two to decide first.
   */
  pendingDataset?: { title?: string | null; author?: string | null } | null;
}

export const PROPOSED_CHART_EVENT = 'superset:change-management:proposed-chart';

const NOTHING: ProposedChartState = { previewable: false, formData: null };

export function announceProposedChart(state: ProposedChartState): void {
  window.dispatchEvent(
    new CustomEvent(PROPOSED_CHART_EVENT, { detail: state }),
  );
}

export function onProposedChart(
  handler: (state: ProposedChartState) => void,
): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<ProposedChartState>).detail ?? NOTHING);
  window.addEventListener(PROPOSED_CHART_EVENT, listener);
  return () => window.removeEventListener(PROPOSED_CHART_EVENT, listener);
}

/**
 * The DOM id of the grid column the review panel renders into.
 *
 * The panel has to sit beside the dashboard content, not inside it, or
 * its height pushes the whole grid down the page. The host lays out an
 * empty slot in its right-hand column and the panel portals into it.
 */
export const REVIEW_PANEL_SLOT = 'change-review-panel-slot';
