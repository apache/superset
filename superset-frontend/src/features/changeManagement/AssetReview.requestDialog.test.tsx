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
 * The dialog opened on the wrong draft.
 *
 * The edit toolbar's Request review saves first and announces in the same
 * breath, so the dialog has to wait for that save. It waited on "is there a
 * draft" -- which is already true for an author editing on top of one, so
 * the wait ended instantly, on the payload the save was in the middle of
 * replacing. Measured at 70ms ahead of it. Submit inside that window and
 * the reviewer gets a draft the author had already moved past, and the save
 * landing afterwards reopens the request they thought they had sent.
 *
 * So the announcement says whether a save is coming, and the wait is for
 * that save rather than for a status that was never evidence of it.
 */
import { render, waitFor, screen } from 'spec/helpers/testing-library';
import AssetReview from './AssetReview';
import { announceChangeCaptured, announceRequestReview } from './events';
import type { ChangeRequest } from './types';

const mockUseAssetReview = jest.fn();
jest.mock('./useAssetReview', () => ({
  useAssetReview: (...args: unknown[]) => mockUseAssetReview(...args),
}));
jest.mock('./ReviewBanner', () => () => <div data-test="banner" />);
jest.mock('./WhatChangedPanel', () => () => null);
// The dialog itself is stubbed down to the one thing under test: whether it
// is open. Its own contents have their own file.
jest.mock('./RequestReviewModal', () => ({ open }: { open: boolean }) =>
  open ? <div data-test="request-dialog" /> : null,
);
const mockPreview = jest.fn();
jest.mock('./useProposedPreview', () => ({
  useProposedPreview: () => mockPreview(),
}));

const draft = {
  id: 727,
  asset_type: 'dashboard',
  asset_id: 6,
  asset_title: 'Sales',
  status: 'draft',
  is_open: true,
  is_author: true,
  can_approve: false,
  changed_fields: ['dashboard_title'],
} as unknown as ChangeRequest;


beforeEach(() => {
  mockUseAssetReview.mockReset();
  mockPreview.mockReset();
  mockPreview.mockReturnValue({
    canPreview: true,
    showing: false,
    busy: false,
    toggle: jest.fn(),
  });
  mockUseAssetReview.mockReturnValue({
    changeRequest: draft,
    refresh: jest.fn(),
  });
});

const mount = () =>
  render(<AssetReview assetType="dashboard" assetId={6} editing />, {
    useRedux: true,
    useRouter: true,
  });

test('a click that saves first waits for that save', async () => {
  mount();

  announceRequestReview({ savingFirst: true });

  // The draft on screen is the one the save is about to replace. Opening
  // here is the fault: an author who submits now sends the reviewer the
  // version they just edited away from.
  await waitFor(() => {
    expect(screen.queryByTestId('request-dialog')).not.toBeInTheDocument();
  });

  announceChangeCaptured();

  await waitFor(() => {
    expect(screen.getByTestId('request-dialog')).toBeInTheDocument();
  });
});

test('a click with nothing to save opens straight away', async () => {
  // The banner's Request review, and the toolbar's when the draft is
  // already stored. There is no save to wait for, and making this case wait
  // would mean waiting out the whole grace period for nothing.
  mount();

  announceRequestReview({ savingFirst: false });

  await waitFor(() => {
    expect(screen.getByTestId('request-dialog')).toBeInTheDocument();
  });
});

test('an announcement with no detail does not wait', async () => {
  // Older callers, and tests. "Nothing said" reads as "nothing to wait
  // for", which is how this behaved before the field existed.
  mount();

  window.dispatchEvent(
    new CustomEvent('superset:change-management:request-review'),
  );

  await waitFor(() => {
    expect(screen.getByTestId('request-dialog')).toBeInTheDocument();
  });
});

test('a returned change is submittable, so the dialog opens on it too', async () => {
  // The toolbar now offers Request review on a change a reviewer sent
  // back, with nothing unsaved -- the server accepts it as it stands
  // (`lifecycle.submit` takes CHANGES_REQUESTED as it takes DRAFT) and the
  // Approvals list has always offered it on the same row. Gated on `draft`
  // alone, that click armed a wait that could never match: the button
  // announced, nothing happened, and the arming was dropped silently when
  // the grace period ran out. An enabled button that does nothing is worse
  // than the disabled one it replaced.
  mockUseAssetReview.mockReturnValue({
    changeRequest: {
      ...draft,
      status: 'changes_requested',
      review_note: 'Use the approved colour scheme.',
      reviewer: { id: 4, first_name: 'Priya', last_name: 'Shah' },
    } as unknown as ChangeRequest,
    refresh: jest.fn(),
  });
  mount();

  announceRequestReview({ savingFirst: false });

  await waitFor(() => {
    expect(screen.getByTestId('request-dialog')).toBeInTheDocument();
  });
});
