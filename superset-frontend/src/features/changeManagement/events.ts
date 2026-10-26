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

export function announceRequestReview(): void {
  window.dispatchEvent(new CustomEvent(REQUEST_REVIEW_EVENT));
}

export function onRequestReview(handler: () => void): () => void {
  window.addEventListener(REQUEST_REVIEW_EVENT, handler);
  return () => window.removeEventListener(REQUEST_REVIEW_EVENT, handler);
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
  window.dispatchEvent(new CustomEvent(CHANGE_CAPTURED_EVENT));
}

export function onChangeCaptured(handler: () => void): () => void {
  window.addEventListener(CHANGE_CAPTURED_EVENT, handler);
  return () => window.removeEventListener(CHANGE_CAPTURED_EVENT, handler);
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
  window.dispatchEvent(new CustomEvent(SHOW_WHAT_CHANGED_EVENT));
}

export function onShowWhatChanged(handler: () => void): () => void {
  window.addEventListener(SHOW_WHAT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SHOW_WHAT_CHANGED_EVENT, handler);
}

export const DISCARD_CHANGES_EVENT = 'superset:change-management:discard';

export function announceDiscardChanges(): void {
  window.dispatchEvent(new CustomEvent(DISCARD_CHANGES_EVENT));
}

export function onDiscardChanges(handler: () => void): () => void {
  window.addEventListener(DISCARD_CHANGES_EVENT, handler);
  return () => window.removeEventListener(DISCARD_CHANGES_EVENT, handler);
}

/**
 * The DOM id of the grid column the review panel renders into.
 *
 * The panel has to sit beside the dashboard content, not inside it, or
 * its height pushes the whole grid down the page. The host lays out an
 * empty slot in its right-hand column and the panel portals into it.
 */
export const REVIEW_PANEL_SLOT = 'change-review-panel-slot';
