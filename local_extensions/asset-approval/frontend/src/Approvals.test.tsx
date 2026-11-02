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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { pages } from '@apache-superset/core';
import Approvals from './Approvals';
import { fetchApprovalsPage } from './api';
import type { ChangeRequest } from './types';

jest.mock('./api', () => ({
  fetchApprovalsPage: jest.fn(),
  approveChange: jest.fn(() => Promise.resolve()),
  requestChanges: jest.fn(() => Promise.resolve()),
  // The real one: reading the server's sentence off a refusal is the
  // behaviour under test, not something to stub out.
  refusalMessage: jest.requireActual('./api').refusalMessage,
}));

const mockedFetchList = fetchApprovalsPage as jest.MockedFunction<
  typeof fetchApprovalsPage
>;

/** The server's shape around a set of rows: it now pages and filters. */
const asPage = (rows: ChangeRequest[]) => ({
  rows,
  count: rows.length,
  authors: rows
    .map(row => row.author)
    .filter((person): person is NonNullable<typeof person> => !!person),
});
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
  mockedFetchList.mockResolvedValue(asPage([]));
});

afterEach(() => jest.clearAllMocks());

test('defaults to the view that needs the reviewer', async () => {
  // `for_me` is the only view that excludes the viewer's own work, so it is
  // the one that answers "is anything waiting on me".
  render(<Approvals />);

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalledWith(
      'for_me',
      expect.objectContaining({ page: 0 }),
    ));
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

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalledWith(
      view,
      expect.objectContaining({ page: 0 }),
    ));
});

test('the list carries the columns mock 16a specifies, in order', async () => {
  mockedFetchList.mockResolvedValue(asPage([request()]));

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
  mockedFetchList.mockResolvedValue(asPage([request({ can_approve: true })]));

  render(<Approvals />);

  expect(await screen.findByText('Needs your review')).toBeInTheDocument();
  expect(screen.getByTestId('review-action')).toBeInTheDocument();
});

test('a row the reader cannot approve offers the asset instead', async () => {
  mockedFetchList.mockResolvedValue(asPage([request({ can_approve: false })]));

  render(<Approvals />);

  expect(await screen.findByText('Awaiting review')).toBeInTheDocument();
  expect(screen.getByTestId('open-action')).toBeInTheDocument();
  expect(screen.queryByTestId('review-action')).not.toBeInTheDocument();
});

test('a change sent back to its author reads as returned', async () => {
  mockedFetchList.mockResolvedValue(asPage([
    request({ status: 'changes_requested', is_author: true }),
  ]));

  render(<Approvals />);

  expect(await screen.findByText('Returned to you')).toBeInTheDocument();
});

test('the Name filter asks the server, so it narrows the whole view', async () => {
  // It used to filter the rows the browser was holding. Once the list is
  // paged that is a different question from the one the filter appears to
  // ask: it would narrow this page and leave matches on the next one
  // unfound (R5-04).
  jest.useFakeTimers();
  try {
    mockedFetchList.mockResolvedValue(asPage([
      request({ id: 1, asset_title: 'Q3 revenue' }),
    ]));

    render(<Approvals />);
    await screen.findByText('Q3 revenue');

    mockedFetchList.mockResolvedValue(asPage([
      request({ id: 2, asset_title: 'Ops overview' }),
    ]));
    fireEvent.change(
      screen.getByPlaceholderText('Type a value') as HTMLInputElement,
      { target: { value: 'ops' } },
    );

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() =>
      expect(mockedFetchList).toHaveBeenLastCalledWith(
        'for_me',
        expect.objectContaining({ name: 'ops', page: 0 }),
      ),
    );
  } finally {
    jest.useRealTimers();
  }
});

test('typing is held back so each keystroke is not a request', async () => {
  jest.useFakeTimers();
  try {
    mockedFetchList.mockResolvedValue(asPage([request()]));
    render(<Approvals />);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    const before = mockedFetchList.mock.calls.length;

    const input = screen.getByPlaceholderText(
      'Type a value',
    ) as HTMLInputElement;
    for (const value of ['o', 'op', 'ops']) {
      fireEvent.change(input, { target: { value } });
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    expect(mockedFetchList.mock.calls.length).toBe(before);

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(mockedFetchList.mock.calls.length).toBe(before + 1);
  } finally {
    jest.useRealTimers();
  }
});

test('an unknown sub-path falls back rather than asking for nothing', async () => {
  mockedUseSubPath.mockReturnValue('/not-a-view');

  render(<Approvals />);

  await waitFor(() => expect(mockedFetchList).toHaveBeenCalledWith(
      'for_me',
      expect.objectContaining({ page: 0 }),
    ));
});

test('a request is shown with everything a reviewer decides on', async () => {
  mockedFetchList.mockResolvedValue(asPage([request()]));

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
  mockedFetchList.mockResolvedValue(asPage([
    request({
      status: 'approved',
      can_approve: false,
      decided_at: new Date(Date.now() - 86_400_000).toISOString(),
      review_note: 'Looks right',
    }),
  ]));

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
  mockedFetchList.mockResolvedValue(asPage([
    request({ id: 9, asset_type: 'dashboard', asset_id: 4, can_approve: true }),
  ]));

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();

  expect(assign).toHaveBeenCalledWith('/superset/dashboard/4/');
});

test('Review on a dataset opens its review here, not a page of its own', async () => {
  // A dataset has no page in Superset -- `assetUrl` can only offer the
  // dataset list -- so the mocks review it in the dataset editor's own
  // tabs, read-only, opened from this list.
  mockedFetchList.mockResolvedValue(asPage([
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
  ]));

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

test('approving a dataset stops to ask first', async () => {
  // The one irreversible step in the workflow. Reviewing on the asset
  // already confirmed; reviewing from this list did not, which left the
  // only action that cannot be undone as the only one that never asked.
  const { approveChange } = jest.requireMock('./api');
  mockedFetchList.mockResolvedValue(asPage([
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
  ]));

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
  mockedFetchList.mockResolvedValue(asPage([
    request({ asset_title: null, asset_type: 'dataset', asset_id: 12 }),
  ]));

  render(<Approvals />);

  expect(await screen.findByText('dataset 12')).toBeInTheDocument();
});

test('a request waiting too long is marked, so the queue shows its own age', async () => {
  // Three days is where the SOW puts "waiting too long". The styling is the
  // only thing that distinguishes it, so it is worth asserting rather than
  // trusting the eye.
  mockedFetchList.mockResolvedValue(asPage([
    request({
      submitted_at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    }),
  ]));

  const { container } = render(<Approvals />);

  await screen.findByText('Q3 revenue');
  const waited = screen.getByText('6 days');
  const fresh = container.querySelector('td:nth-child(5) span');

  expect(waited).toBe(fresh);
  // The stale and fresh cases must not render identically.
  expect(getComputedStyle(waited).color).not.toBe('');
});

test('a recently submitted request is not marked', async () => {
  mockedFetchList.mockResolvedValue(asPage([
    request({ submitted_at: new Date(Date.now() - 3600_000).toISOString() }),
  ]));

  render(<Approvals />);

  await screen.findByText('Q3 revenue');
  expect(screen.getByText('an hour')).toBeInTheDocument();
});

test('a refused approval says why, and the list re-reads', async () => {
  // R4-04: the rejection was not handled at all, so a refused approve left
  // the dialog open over a list that had not moved and gave the reader no
  // reason. The refusal the server sends for this case is the one that
  // tells them the change moved while they had it open.
  const { approveChange } = jest.requireMock('./api');
  const refusal =
    'This change was updated after you opened it. Review the new version before approving.';
  approveChange.mockRejectedValueOnce(Object.assign(new Error(refusal)));
  mockedFetchList.mockResolvedValue(asPage([
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
  ]));

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();
  fireEvent.click((await screen.findByText('Approve')).closest('button')!);
  await screen.findByText('Approve and publish?');
  fireEvent.click(
    (await screen.findByText('Approve and publish')).closest('button')!,
  );

  // The server's own sentence reaches the reader...
  expect(await screen.findByText(refusal)).toBeInTheDocument();
  // ...and the list is read again, so it shows the version that refused.
  await waitFor(() => expect(mockedFetchList).toHaveBeenCalledTimes(2));
});

test('a refusal that arrives as a Response still says why', async () => {
  // SupersetClient rejects with the Response, not an Error holding the body,
  // so reading `message` off the rejection finds nothing. This is the shape
  // the approve path actually sees (R4-04).
  const { approveChange } = jest.requireMock('./api');
  const refusal = 'The dataset changed while this review was open.';
  // Stood up by hand rather than with `new Response`: this jsdom has no
  // fetch types, and `clone().json()` is the whole of the contract the
  // helper relies on.
  const body = { message: refusal };
  const rejection = {
    status: 409,
    clone: () => ({ json: () => Promise.resolve(body) }),
  };
  approveChange.mockRejectedValueOnce(rejection);
  mockedFetchList.mockResolvedValue(asPage([
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
  ]));

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();
  fireEvent.click((await screen.findByText('Approve')).closest('button')!);
  await screen.findByText('Approve and publish?');
  fireEvent.click(
    (await screen.findByText('Approve and publish')).closest('button')!,
  );

  expect(await screen.findByText(refusal)).toBeInTheDocument();
});

test('a change on an archived asset is decided here, not on a page it no longer has', async () => {
  // R3-01: sending the reviewer to the asset sends them to an archived
  // chart -- Explore opens empty, says the dataset is missing, and carries
  // no review controls, so the request could be seen and still not acted on.
  const assign = jest.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  mockedFetchList.mockResolvedValue(asPage([
    request({
      id: 9,
      asset_type: 'chart',
      asset_title: 'Genders by State',
      can_approve: true,
      command: 'restore',
      asset_archived: true,
    }),
  ]));

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();

  // Decided in place, and nothing navigated away.
  expect(await screen.findByText('Approve and publish?')).toBeInTheDocument();
  expect(assign).not.toHaveBeenCalled();
});

test('any change on an archived asset is decided here, whatever its command', async () => {
  // The standing property R3-01's fix should have been. The first fix read
  // the row's `command`, so only a restore avoided the dead page and every
  // other change about an archived asset walked straight into it. The row
  // now carries what the server knows about the asset.
  const assign = jest.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  mockedFetchList.mockResolvedValue(asPage([
    request({
      id: 11,
      asset_type: 'chart',
      asset_title: 'Genders by State',
      can_approve: true,
      // No command at all: an ordinary update, about an asset that has
      // since been archived.
      command: null,
      asset_archived: true,
    }),
  ]));

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();

  expect(await screen.findByText('Approve and publish?')).toBeInTheDocument();
  expect(assign).not.toHaveBeenCalled();
});

test('a change on a live asset is still reviewed on the asset', async () => {
  // The other half: the default has to keep working, or every review
  // loses the banner and the in-place panel.
  const assign = jest.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  mockedFetchList.mockResolvedValue(asPage([
    request({
      id: 12,
      asset_type: 'chart',
      asset_id: 69,
      can_approve: true,
      asset_archived: false,
    }),
  ]));

  render(<Approvals />);

  (await screen.findByTestId('review-action')).click();

  expect(assign).toHaveBeenCalledWith('/explore/?slice_id=69');
});

test('a row whose author has lost edit access says so before the button', async () => {
  // QA-07: approving is refused with a 409, and the request stays
  // approvable by decision, so `can_approve` still says yes. Without this
  // the approver met the refusal only after pressing Approve.
  mockedFetchList.mockResolvedValue(asPage([
    request({
      can_approve: true,
      is_open: true,
      author_can_still_edit: false,
    }),
  ]));

  render(<Approvals />);

  const note = await screen.findByTestId('author-lost-access');
  // Names the author, so the reader knows whose access to restore.
  expect(note.textContent).toContain('Mo Maker');
  expect(note.textContent).toContain('no longer has edit access');
  // Still offered: the recorded decision was to keep it approvable and
  // show them, not to take the action away.
  expect(screen.getByTestId('review-action')).toBeInTheDocument();
});

test('a row whose author still holds the asset carries no note', async () => {
  mockedFetchList.mockResolvedValue(asPage([
    request({ can_approve: true, is_open: true, author_can_still_edit: true }),
  ]));

  render(<Approvals />);

  await screen.findByTestId('review-action');
  expect(
    screen.queryByTestId('author-lost-access'),
  ).not.toBeInTheDocument();
});

test('a decided row does not warn about access that no longer matters', async () => {
  // Nothing is going to be published from a closed request, so the note
  // would be noise on the Recently decided view.
  mockedFetchList.mockResolvedValue(asPage([
    request({
      status: 'approved',
      can_approve: true,
      is_open: false,
      author_can_still_edit: false,
    }),
  ]));

  render(<Approvals />);

  await screen.findByTestId('review-action');
  expect(
    screen.queryByTestId('author-lost-access'),
  ).not.toBeInTheDocument();
});
