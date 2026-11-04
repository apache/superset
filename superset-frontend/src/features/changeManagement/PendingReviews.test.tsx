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
/**
 * @fileoverview Home shows a reviewer's queue to people who can review.
 *
 * R7-08: a viewer (no editorship, nothing to approve or submit) saw a
 * "Pending reviews" section on Home, collapsed or reading "Nothing needs you
 * right now". The page leaves the section out for anyone who cannot take part
 * (`canTakePartInReview`); this is also what the component does for itself
 * when it is told who is looking, and it no longer reads a failed request as
 * an empty queue.
 */

import { render, screen, waitFor } from 'spec/helpers/testing-library';
import PendingReviews, { canTakePartInReview } from './PendingReviews';
import * as api from './api';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

jest.mock('./api');
const mockedFetchList = api.fetchList as jest.MockedFunction<typeof api.fetchList>;

const userWith = (...permissions: [string, string][]) =>
  ({
    userId: 5,
    username: 'pat',
    permissions: {},
    roles: { Custom: permissions.map(([view, name]) => [name, view]) },
  }) as unknown as UserWithPermissionsAndRoles;

const viewer = userWith(['Dashboard', 'can_read'], ['Chart', 'can_read']);
const editor = userWith(['Dashboard', 'can_write']);
const admin = {
  userId: 1,
  username: 'root',
  permissions: {},
  roles: { Admin: [['can_write', 'Dashboard']] },
} as unknown as UserWithPermissionsAndRoles;

afterEach(() => jest.clearAllMocks());

test('a viewer cannot take part in review', () => {
  expect(canTakePartInReview(viewer)).toBe(false);
});

test('someone who can write an asset can', () => {
  expect(canTakePartInReview(editor)).toBe(true);
  expect(canTakePartInReview(admin)).toBe(true);
});

test('nobody known cannot', () => {
  expect(canTakePartInReview(undefined)).toBe(false);
});

test('a viewer is shown no section and no queue is requested for them', () => {
  const { container } = render(<PendingReviews user={viewer} />);

  expect(container).toBeEmptyDOMElement();
  expect(screen.queryByText('Nothing needs you right now')).not.toBeInTheDocument();
  expect(mockedFetchList).not.toHaveBeenCalled();
});

test('an editor with nothing waiting is told so, in the empty state', async () => {
  mockedFetchList.mockResolvedValue([]);

  render(<PendingReviews user={editor} />);

  expect(await screen.findByTestId('home-reviews-empty')).toHaveTextContent(
    'Nothing needs you right now',
  );
});

test('a queue that could not be read is not reported as empty', async () => {
  // The old catch set the rows to [] and the page said nothing needed the
  // reviewer, while their work sat unread.
  mockedFetchList.mockRejectedValue(new Error('500'));

  render(<PendingReviews user={editor} />);

  await waitFor(() =>
    expect(screen.getByTestId('home-reviews-failed')).toBeInTheDocument(),
  );
  expect(screen.queryByText('Nothing needs you right now')).not.toBeInTheDocument();
});

test('the empty message is not shown before the queue has loaded', () => {
  mockedFetchList.mockReturnValue(new Promise(() => {}));

  render(<PendingReviews user={editor} />);

  expect(screen.getByTestId('home-reviews-loading')).toBeInTheDocument();
  expect(screen.queryByText('Nothing needs you right now')).not.toBeInTheDocument();
});

test('without being told who is looking it behaves as it did', async () => {
  mockedFetchList.mockResolvedValue([]);

  render(<PendingReviews />);

  expect(await screen.findByTestId('home-reviews-empty')).toBeInTheDocument();
});
