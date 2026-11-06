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
 * @fileoverview QA-93: the reviewer's note survives, and says which round it is.
 *
 * The note used to be nulled by the author's next save, so the person it was
 * written for lost it the moment they started revising against it. It now
 * stays on the request, which means the panel can be read at three different
 * moments and has to be honest about each: the open ask while the request is
 * back with the author, and the previous round once they have resubmitted or
 * it has been approved. Titling the second "What needs to change" would hand
 * the next reviewer a stale instruction as though it were outstanding --
 * which is the mistake the Approvals list already avoids (sc-131033).
 */

import { render, screen } from 'spec/helpers/testing-library';
import WhatChangedPanel from './WhatChangedPanel';
import type { ChangeRequest } from './types';

jest.mock('src/utils/getControlsForVizType', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));
jest.mock('./DatasetReview', () => () => null);

const SENT_BACK = 'The subtitle still names last quarter - please update it.';

const request = (over: Partial<ChangeRequest> = {}): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'chart',
    asset_id: 7,
    asset_title: 'Signups by week',
    status: 'changes_requested',
    operation: 'update',
    is_open: true,
    is_author: true,
    can_approve: false,
    author: { id: 2, first_name: 'Mo', last_name: 'Maker' },
    reviewer: { id: 9, first_name: 'Priya', last_name: 'Shah' },
    review_note: SENT_BACK,
    changed_on: new Date().toISOString(),
    changed_fields: [],
    proposed: {},
    changes: [{ field: 'slice_name', before: 'Old', after: 'New' }],
    ...over,
  }) as unknown as ChangeRequest;

const show = (changeRequest: ChangeRequest) =>
  render(
    <WhatChangedPanel
      changeRequest={changeRequest}
      onClose={jest.fn()}
      review={{ busy: false, onApprove: jest.fn(), onRequestChanges: jest.fn() }}
    />,
    { useRedux: true, useRouter: true },
  );

test('the author revising against the note reads it as the open ask', () => {
  show(request());

  expect(screen.getByText('What needs to change')).toBeInTheDocument();
  expect(screen.getByText(SENT_BACK)).toBeInTheDocument();
});

test('once resubmitted the same note is named as the previous round', () => {
  // The note is still worth showing -- it is the only record of why the
  // change came back -- but a reviewer opening a pending request must not
  // read it as something still being asked for.
  show(request({ status: 'pending', is_author: false, can_approve: true }));

  expect(screen.getByText('What the last review asked for')).toBeInTheDocument();
  expect(screen.getByText(SENT_BACK)).toBeInTheDocument();
  expect(screen.queryByText('What needs to change')).not.toBeInTheDocument();
});

test('and after approval, where nothing is being asked for at all', () => {
  show(request({ status: 'approved', is_author: false, can_approve: false }));

  expect(screen.queryByText('What needs to change')).not.toBeInTheDocument();
  expect(screen.getByText('What the last review asked for')).toBeInTheDocument();
});

test('a request that was never sent back shows no note section', () => {
  show(request({ status: 'pending', review_note: null, is_author: false }));

  expect(screen.queryByText('What needs to change')).not.toBeInTheDocument();
  expect(
    screen.queryByText('What the last review asked for'),
  ).not.toBeInTheDocument();
});

test('the reviewer who wrote it is still named', () => {
  show(request());

  expect(screen.getByText('— Priya Shah')).toBeInTheDocument();
});
