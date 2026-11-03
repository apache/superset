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
 * @fileoverview The bell's two groups do not overlap.
 *
 * The popover reads `for_me` into "Needs your review" and `submitted_by_me`
 * filtered to `changes_requested` into "Returned to you". Widening `for_me`
 * to carry the reader's own returned changes -- which the Approvals page
 * needs, because a change sent back is waiting on its author (sc-131033) --
 * put those rows in both groups at once, and under "Needs your review" a
 * returned change reads as the reader waiting on themselves.
 *
 * Nothing tested the bell, which is why that was not caught.
 */

import { fireEvent, render, screen, waitFor } from 'spec/helpers/testing-library';
import { FeatureFlag } from '@superset-ui/core';
import NotificationBell from './NotificationBell';
import type { ChangeRequest } from './types';

jest.mock('./api', () => ({
  fetchList: jest.fn(),
  fetchPendingCount: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const api = require('./api');

const ME = { id: 2, first_name: 'Priya', last_name: 'Shah' };
const REVIEWER = { id: 3, first_name: 'Alex', last_name: 'Rivera' };

const row = (over: Partial<ChangeRequest>): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'dashboard',
    asset_id: 7,
    asset_title: 'Quarterly revenue',
    status: 'pending',
    is_open: true,
    is_author: false,
    author: REVIEWER,
    reviewer: null,
    submitted_at: new Date().toISOString(),
    decided_at: null,
    ...over,
  }) as unknown as ChangeRequest;

/** The reader's own change, sent back to them. */
const returnedToMe = row({
  id: 9,
  asset_title: 'My dashboard',
  status: 'changes_requested',
  is_author: true,
  author: ME,
  reviewer: REVIEWER,
  decided_at: new Date().toISOString(),
});

/** Somebody else's change, waiting on the reader as approver. */
const needsMe = row({ id: 4, asset_title: 'Their dashboard' });

const open = async () => {
  render(<NotificationBell />, { useRedux: true, useRouter: true });
  await waitFor(() => expect(api.fetchPendingCount).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button'));
  await screen.findByTestId('review-bell-panel');
};

beforeEach(() => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
  api.fetchPendingCount.mockReset();
  api.fetchList.mockReset();
  api.fetchPendingCount.mockResolvedValue({ needs_me: 1, returned: 1 });
  // What the server now answers: the returned row is in both views.
  api.fetchList.mockImplementation((show: string) =>
    Promise.resolve(
      show === 'for_me' ? [needsMe, returnedToMe] : [returnedToMe],
    ),
  );
});

afterEach(() => {
  window.featureFlags = {};
});

test('a change returned to me is listed once, not in both groups', async () => {
  await open();

  expect(screen.getAllByText('My dashboard')).toHaveLength(1);
});

test('it is listed under Returned to you, not under Needs your review', async () => {
  await open();

  expect(screen.getByText('Returned to you')).toBeInTheDocument();
  // The returned group names the reviewer who sent it back.
  expect(screen.getByText(/Alex Rivera requested changes/)).toBeInTheDocument();
  // The review group's wording must not be applied to my own change.
  expect(screen.queryByText(/Priya Shah · waiting/)).not.toBeInTheDocument();
});

test('a review genuinely waiting on me is still listed', async () => {
  await open();

  expect(screen.getByText('Needs your review')).toBeInTheDocument();
  expect(screen.getByText('Their dashboard')).toBeInTheDocument();
});

test('with nothing returned, the review group is unaffected', async () => {
  api.fetchList.mockImplementation((show: string) =>
    Promise.resolve(show === 'for_me' ? [needsMe] : []),
  );

  await open();

  expect(screen.getByText('Their dashboard')).toBeInTheDocument();
  expect(screen.queryByText('Returned to you')).not.toBeInTheDocument();
});

test('somebody else s returned change is not filtered out of my review group', async () => {
  // The filter must key on being the author, not merely on the status, or a
  // returned change I could act on as an approver would vanish.
  const theirsReturned = row({
    id: 11,
    asset_title: 'Not mine',
    status: 'changes_requested',
    is_author: false,
  });
  api.fetchList.mockImplementation((show: string) =>
    Promise.resolve(show === 'for_me' ? [theirsReturned] : []),
  );

  await open();

  expect(screen.getByText('Not mine')).toBeInTheDocument();
});
