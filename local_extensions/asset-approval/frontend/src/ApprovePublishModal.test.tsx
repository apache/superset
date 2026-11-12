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
 * @fileoverview The confirmation every Approve button ends at.
 *
 * It is the one place that holds for the panel, the dataset dialog and the
 * Approvals page alike, so it is where a request with nothing to read is
 * stopped, and where a keyword is repeated to the person pressing the button.
 */

import { render, screen } from '@testing-library/react';
import ApprovePublishModal from './ApprovePublishModal';
import type { ChangeRequest } from './types';

const base = {
  id: 1,
  asset_type: 'chart',
  asset_id: 42,
  status: 'pending',
  is_open: true,
  operation: 'update',
  changed_fields: ['viz_type'],
  changes: [{ field: 'viz_type', before: 'bar', after: 'line' }],
  proposed: {},
} as unknown as ChangeRequest;

const renderModal = (changeRequest: ChangeRequest) =>
  render(
    <ApprovePublishModal
      changeRequest={changeRequest}
      open
      onClose={() => {}}
      onConfirm={() => {}}
    />,
  );


test('a request with nothing to read cannot be confirmed', () => {
  // Every Approve button ends at this dialog, so this is the place that
  // holds for all of them.
  renderModal({ ...base, changes: [], changed_fields: [] } as unknown as ChangeRequest);

  expect(screen.getByTestId('review-blocked')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve and publish' })).toBeDisabled();
});

test('a keyword is repeated at the moment of approval', () => {
  renderModal({
    ...base,
    changes: [
      {
        field: 'save_to_dashboard_id',
        keyword: true,
        summary: 'Also adds this chart to the dashboard "Board pack". That dashboard is PUBLISHED.',
        after: 'Board pack',
      },
    ],
  } as unknown as ChangeRequest);

  expect(screen.getByTestId('approve-keywords')).toHaveTextContent('PUBLISHED');
  expect(screen.getByRole('button', { name: 'Approve and publish' })).toBeEnabled();
});

test('a dashboard whose chart has a change waiting says so before approval', () => {
  // R4-03. The server computes this and sends it on the request. Approving
  // anyway publishes the dashboard around the charts as they are now, which
  // is a decision the reviewer can only make if they are told. The reading
  // of the field stayed in core when these screens moved into the
  // extension, so the API went on sending a warning nothing drew.
  renderModal({
    ...base,
    asset_type: 'dashboard',
    pending_dependency: {
      asset_type: 'chart',
      asset_id: 7,
      change_request_id: 9,
      status: 'pending',
      count: 2,
      author: { username: 'priya', first_name: 'Priya', last_name: 'Shah' },
    },
  } as unknown as ChangeRequest);

  expect(screen.getByTestId('pending-dependency-warning')).toBeInTheDocument();
  expect(
    screen.getByText('2 charts on this dashboard have changes waiting'),
  ).toBeInTheDocument();
  // Named, because the reviewer's next move is to go and ask them.
  expect(screen.getByText(/Priya Shah/)).toBeInTheDocument();
});

test('a chart whose dataset has a change waiting is warned in its own words', () => {
  // The other direction, which reads differently: the chart would publish
  // against the old dataset and break for viewers.
  renderModal({
    ...base,
    pending_dependency: {
      asset_type: 'dataset',
      asset_id: 3,
      change_request_id: 11,
      status: 'pending',
    },
  } as unknown as ChangeRequest);

  expect(
    screen.getByText('The dataset this chart uses has a change waiting'),
  ).toBeInTheDocument();
});

test('a request with nothing waiting under it shows no warning', () => {
  // Absent rather than empty: a warning box with nothing in it reads as a
  // problem the reviewer cannot find.
  renderModal(base);

  expect(
    screen.queryByTestId('pending-dependency-warning'),
  ).not.toBeInTheDocument();
});
