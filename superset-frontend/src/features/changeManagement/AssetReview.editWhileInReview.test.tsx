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
 * Two buttons on one page, both labelled Edit, doing different things.
 *
 * An author whose change is with a reviewer had two ways to edit it. The
 * banner's Edit asked first, naming the approvers it was about to take it
 * away from. The dashboard's own Edit button went straight into the
 * editor, left the request sitting in the reviewer's queue while the
 * author worked on top of it, and pulled it out silently at save time --
 * which is where "your draft has been overwritten" came from.
 *
 * Both are the same decision, so both now reach the same dialog. And the
 * dialog finishes what its button offers: it reads "Withdraw and edit" and
 * used only to withdraw, leaving the author to press Edit a second time
 * for the half they had already confirmed.
 */
import { render, waitFor, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import AssetReview from './AssetReview';
import {
  announceWithdrawToEdit,
  onEditAfterWithdraw,
  WITHDRAW_TO_EDIT_EVENT,
} from './events';
import type { ChangeRequest } from './types';

const mockUseAssetReview = jest.fn();
jest.mock('./useAssetReview', () => ({
  useAssetReview: (...args: unknown[]) => mockUseAssetReview(...args),
}));
jest.mock('./ReviewBanner', () => () => <div data-test="banner" />);
jest.mock('./WhatChangedPanel', () => () => null);
const mockPreview = jest.fn();
jest.mock('./useProposedPreview', () => ({
  useProposedPreview: () => mockPreview(),
}));

const mockWithdraw = jest.fn();
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  withdrawRequest: (...args: unknown[]) => mockWithdraw(...args),
}));

const pending = {
  id: 728,
  asset_type: 'dashboard',
  asset_id: 6,
  asset_title: 'Sales',
  status: 'pending',
  is_open: true,
  is_author: true,
  can_approve: false,
  changed_fields: ['dashboard_title'],
  eligible_approvers: [{ first_name: 'Priya', last_name: 'Sharma' }],
  submitted_at: new Date().toISOString(),
} as unknown as ChangeRequest;

const refresh = jest.fn();

beforeEach(() => {
  mockUseAssetReview.mockReset();
  mockPreview.mockReset();
  mockWithdraw.mockReset();
  refresh.mockReset();
  mockWithdraw.mockResolvedValue(undefined);
  refresh.mockResolvedValue(undefined);
  mockPreview.mockReturnValue({
    canPreview: false,
    showing: false,
    busy: false,
    toggle: jest.fn(),
    restoreLive: jest.fn(async () => {}),
  });
  mockUseAssetReview.mockReturnValue({ changeRequest: pending, refresh });
});

const mount = () =>
  render(<AssetReview assetType="dashboard" assetId={6} />, {
    useRedux: true,
    useRouter: true,
  });

test('the host’s Edit button reaches the same dialog as the banner’s', async () => {
  // The header cannot raise this itself: the sentence names the approvers,
  // and the header has no idea who they are.
  mount();

  announceWithdrawToEdit();

  await waitFor(() => {
    expect(screen.getByTestId('withdraw-modal')).toBeInTheDocument();
  });
  // Named, because the author cannot see the queue they are leaving.
  expect(screen.getByText(/Priya Sharma/)).toBeInTheDocument();
});

test('confirming withdraws and then enters edit mode', async () => {
  // "Withdraw and edit" did only the first half.
  const entered = jest.fn();
  const stop = onEditAfterWithdraw(entered);
  mount();

  announceWithdrawToEdit();
  await screen.findByTestId('withdraw-modal');
  userEvent.click(screen.getByRole('button', { name: /Withdraw and edit/i }));

  await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith(728));
  await waitFor(() => expect(entered).toHaveBeenCalled());

  stop();
});

test('a refused withdrawal does not open the editor', async () => {
  // The change is not theirs to edit after all, and opening the editor
  // would invite a save the server is about to turn down.
  mockWithdraw.mockRejectedValue(new Error('someone else moved it'));
  const entered = jest.fn();
  const stop = onEditAfterWithdraw(entered);
  mount();

  announceWithdrawToEdit();
  await screen.findByTestId('withdraw-modal');
  userEvent.click(screen.getByRole('button', { name: /Withdraw and edit/i }));

  await waitFor(() => expect(mockWithdraw).toHaveBeenCalled());
  expect(entered).not.toHaveBeenCalled();

  stop();
});

test('the signal carries nothing the listener has to trust', () => {
  // A plain event: the review component already holds the request, and
  // reading the asset off a window event would be a second source for a
  // fact it can look up.
  const seen: Event[] = [];
  const handler = (event: Event) => seen.push(event);
  window.addEventListener(WITHDRAW_TO_EDIT_EVENT, handler);

  announceWithdrawToEdit();

  expect(seen).toHaveLength(1);
  window.removeEventListener(WITHDRAW_TO_EDIT_EVENT, handler);
});
