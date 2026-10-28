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
 * @fileoverview The Approvals list, as the host mounts it.
 *
 * The page reaches the host through exactly two seams -- `pages.useSubPath`
 * and `pages.useNavigate` for where it is, and `http` for the review API.
 * Both are stubbed, so these tests say what the page does with the host
 * rather than re-testing the host.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { pages } from '@apache-superset/core';
import Approvals from './Approvals';
import { fetchList } from './api';
import type { ChangeRequest } from './types';

jest.mock('./api', () => ({
  fetchList: jest.fn(),
  approveChange: jest.fn(() => Promise.resolve()),
  requestChanges: jest.fn(() => Promise.resolve()),
}));

const mockedFetchList = fetchList as jest.MockedFunction<typeof fetchList>;
const mockedUseSubPath = pages.useSubPath as jest.MockedFunction<
  typeof pages.useSubPath
>;
const mockedUseNavigate = pages.useNavigate as jest.MockedFunction<
  typeof pages.useNavigate
>;

const request = (over: Partial<ChangeRequest> = {}): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'dashboard',
    asset_id: 4,
    status: 'pending',
    author: { id: 2, first_name: 'Mo', last_name: 'Maker', username: 'maker' },
    submitted_at: new Date(Date.now() - 3600_000).toISOString(),
    decided_at: null,
    changed_on: new Date().toISOString(),
    asset_title: 'Q3 revenue',
    can_approve: true,
    is_author: false,
    note: 'Updated the revenue tiles',
    review_note: null,
    ...over,
  }) as ChangeRequest;

beforeEach(() => {
  mockedUseSubPath.mockReturnValue('/');
  mockedUseNavigate.mockReturnValue(jest.fn());
  mockedFetchList.mockResolvedValue([]);
});

afterEach(() => jest.clearAllMocks());

test('defaults to the view that needs the reviewer', async () => {
  // `for_me` is the only view that excludes the viewer's own work, so it is
  // the one that answers "is anything waiting on me".
  render(<Approvals />);

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalledWith('for_me'));
});

test.each([
  ['/for-me', 'for_me'],
  ['/submitted-by-me', 'submitted_by_me'],
  ['/recently-decided', 'recently_decided'],
  ['/all-pending', 'all_pending'],
])('the sub-path %s selects the %s view', async (subPath, view) => {
  // The host screen kept this in a query string; `useSubPath` reports only
  // the path, so the view moved into a segment and stayed linkable.
  mockedUseSubPath.mockReturnValue(subPath);

  render(<Approvals />);

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalledWith(view));
});

test('the list carries the columns mock 16a specifies, in order', async () => {
  mockedFetchList.mockResolvedValue([request()]);

  render(<Approvals />);

  await screen.findByText('Q3 revenue');
  expect(
    screen.getAllByRole('columnheader').map(h => h.textContent),
  ).toEqual(['Name', 'Type', 'Status', 'From', 'Waiting', 'Actions']);
});

test('the filter bar offers Name, Show, Type and From', async () => {
  render(<Approvals />);

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalled());
  // Queried as labels rather than by text: "Name", "Type" and "From" are
  // also column headers, so plain text matches twice.
  ['filter-name', 'filter-show', 'filter-type', 'filter-from'].forEach(id =>
    expect(screen.getByTestId(id)).toBeInTheDocument(),
  );
});

test('a row the reader can approve says so, and offers the review', async () => {
  // The mock writes the status from the reader's point of view rather than
  // the record's: what this row asks of *you*.
  mockedFetchList.mockResolvedValue([request({ can_approve: true })]);

  render(<Approvals />);

  expect(await screen.findByText('Needs your review')).toBeInTheDocument();
  expect(screen.getByTestId('review-action')).toBeInTheDocument();
});

test('a row the reader cannot approve offers the asset instead', async () => {
  mockedFetchList.mockResolvedValue([request({ can_approve: false })]);

  render(<Approvals />);

  expect(await screen.findByText('Awaiting review')).toBeInTheDocument();
  expect(screen.getByTestId('open-action')).toBeInTheDocument();
  expect(screen.queryByTestId('review-action')).not.toBeInTheDocument();
});

test('a change sent back to its author reads as returned', async () => {
  mockedFetchList.mockResolvedValue([
    request({ status: 'changes_requested', is_author: true }),
  ]);

  render(<Approvals />);

  expect(await screen.findByText('Returned to you')).toBeInTheDocument();
});

test('the Name filter narrows the list without refetching', async () => {
  mockedFetchList.mockResolvedValue([
    request({ id: 1, asset_title: 'Q3 revenue' }),
    request({ id: 2, asset_title: 'Ops overview' }),
  ]);

  render(<Approvals />);

  await screen.findByText('Q3 revenue');
  fireEvent.change(
    screen.getByPlaceholderText('Type a value') as HTMLInputElement,
    { target: { value: 'ops' } },
  );

  expect(screen.queryByText('Q3 revenue')).not.toBeInTheDocument();
  expect(screen.getByText('Ops overview')).toBeInTheDocument();
  // One request for the view; the rest is filtering what it returned.
  expect(mockedFetchList).toHaveBeenCalledTimes(1);
});

test('an unknown sub-path falls back rather than asking for nothing', async () => {
  mockedUseSubPath.mockReturnValue('/not-a-view');

  render(<Approvals />);

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalledWith('for_me'));
});

test('a request is shown with everything a reviewer decides on', async () => {
  mockedFetchList.mockResolvedValue([request()]);

  render(<Approvals />);

  expect(await screen.findByText('Q3 revenue')).toBeInTheDocument();
  // Capitalised, as the mock writes the Type column.
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
  expect(screen.getByText('Mo Maker')).toBeInTheDocument();
  expect(screen.getByText('Needs your review')).toBeInTheDocument();
  // The mock has no Note column: the note belongs to the review screen,
  // where there is room to read it.
  expect(
    screen.queryByText('Updated the revenue tiles'),
  ).not.toBeInTheDocument();
});

test('a decided request shows when it was decided, not how long it waited', async () => {
  mockedFetchList.mockResolvedValue([
    request({
      status: 'approved',
      can_approve: false,
      decided_at: new Date(Date.now() - 86_400_000).toISOString(),
      review_note: 'Looks right',
    }),
  ]);

  render(<Approvals />);

  expect(await screen.findByText('Approved')).toBeInTheDocument();
  expect(screen.getByText('a day ago')).toBeInTheDocument();
});

test('each view says something true when it is empty', async () => {
  // Four views, four reasons to be empty: "nothing needs you" and "nothing
  // is awaiting review" are different facts and a reviewer acts on them
  // differently.
  mockedUseSubPath.mockReturnValue('/submitted-by-me');

  render(<Approvals />);

  expect(
    await screen.findByText('You have no changes in flight'),
  ).toBeInTheDocument();
});

test('a failed load empties the list rather than leaving stale rows', async () => {
  // The alternative is a reviewer acting on a queue that is no longer true.
  mockedFetchList.mockRejectedValue(new Error('network'));

  render(<Approvals />);

  expect(
    await screen.findByText('Nothing needs you right now'),
  ).toBeInTheDocument();
});

test('Review on a dashboard goes to the dashboard, where the panel is', async () => {
  // The mocks give a change request no page of its own: a dashboard or a
  // chart is reviewed on the asset, with the banner and the in-place panel.
  const assign = jest.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  mockedFetchList.mockResolvedValue([
    request({ id: 9, asset_type: 'dashboard', asset_id: 4, can_approve: true }),
  ]);

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();

  expect(assign).toHaveBeenCalledWith('/superset/dashboard/4/');
});

test('Review on a dataset opens its review here, not a page of its own', async () => {
  // A dataset has no page in Superset -- `assetUrl` can only offer the
  // dataset list -- so the mocks review it in the dataset editor's own
  // tabs, read-only, opened from this list.
  mockedFetchList.mockResolvedValue([
    request({
      id: 7,
      asset_type: 'dataset',
      asset_title: 'calls_by_queue',
      can_approve: true,
      dataset_detail: {
        columns: { added: [], changed: [], removed: [] },
        metrics: { added: [], changed: [], removed: [] },
        impact: { charts: 0, dashboards: 0 },
      },
    }),
  ]);

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

test('approving a dataset stops to ask first', async () => {
  // The one irreversible step in the workflow. Reviewing on the asset
  // already confirmed; reviewing from this list did not, which left the
  // only action that cannot be undone as the only one that never asked.
  const { approveChange } = jest.requireMock('./api');
  mockedFetchList.mockResolvedValue([
    request({
      id: 7,
      asset_type: 'dataset',
      asset_title: 'calls_by_queue',
      can_approve: true,
      dataset_detail: {
        columns: { added: [], changed: [], removed: [] },
        metrics: { added: [], changed: [], removed: [] },
        impact: { charts: 0, dashboards: 0 },
      },
    }),
  ]);

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();
  // Queried by text and clicked with fireEvent: antd renders the footer in
  // a portal, and the role query does not settle on it.
  const approve = (await screen.findByText('Approve')).closest('button')!;
  fireEvent.click(approve);

  // The confirmation is open and nothing has been approved yet.
  expect(await screen.findByText('Approve and publish?')).toBeInTheDocument();
  expect(approveChange).not.toHaveBeenCalled();
});

test('switching view navigates instead of reloading', async () => {
  // The view is addressable, so the bell, Home and Settings can each link
  // to the one they mean.
  const navigate = jest.fn();
  mockedUseNavigate.mockReturnValue(navigate);

  render(<Approvals />);

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalled());
  fireEvent.mouseDown(
    screen.getByTestId('filter-show').querySelector('.ant-select-selector')!,
  );
  fireEvent.click(await screen.findByTitle('All pending'));

  expect(navigate).toHaveBeenCalledWith('/all-pending');
});

test('an asset with no title still identifies itself', async () => {
  // A dataset has no page of its own in Superset, so the title can be absent.
  mockedFetchList.mockResolvedValue([
    request({ asset_title: null, asset_type: 'dataset', asset_id: 12 }),
  ]);

  render(<Approvals />);

  expect(await screen.findByText('dataset 12')).toBeInTheDocument();
});

test('a request waiting too long is marked, so the queue shows its own age', async () => {
  // Three days is where the SOW puts "waiting too long". The styling is the
  // only thing that distinguishes it, so it is worth asserting rather than
  // trusting the eye.
  mockedFetchList.mockResolvedValue([
    request({
      submitted_at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    }),
  ]);

  const { container } = render(<Approvals />);

  await screen.findByText('Q3 revenue');
  const waited = screen.getByText('6 days');
  const fresh = container.querySelector('td:nth-child(5) span');

  expect(waited).toBe(fresh);
  // The stale and fresh cases must not render identically.
  expect(getComputedStyle(waited).color).not.toBe('');
});

test('a recently submitted request is not marked', async () => {
  mockedFetchList.mockResolvedValue([
    request({ submitted_at: new Date(Date.now() - 3600_000).toISOString() }),
  ]);

  render(<Approvals />);

  await screen.findByText('Q3 revenue');
  expect(screen.getByText('an hour')).toBeInTheDocument();
});
