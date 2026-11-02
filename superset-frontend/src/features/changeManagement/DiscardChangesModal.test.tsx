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
 * @fileoverview Who the discard confirmation is talking to.
 *
 * SOW 5.3 lets any editor discard, so clearing somebody else's draft is the
 * normal case and the copy was written for it. The author clearing their own
 * was then told about itself in the third person, down to a note explaining
 * that they would see "Discarded by you" (R4-02).
 */
import { render, screen } from 'spec/helpers/testing-library';
import DiscardChangesModal from './DiscardChangesModal';
import type { ChangeRequest } from './types';

const changeRequest = (over: Partial<ChangeRequest> = {}): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'dashboard',
    asset_id: 4,
    status: 'draft',
    author: {
      id: 2,
      first_name: 'Alex',
      last_name: 'Rivera',
      username: 'alex',
    },
    changed_on: new Date().toISOString(),
    changed_fields: ['dashboard_title'],
    // The count is read off `changes`, not off the field names.
    changes: [{ field: 'dashboard_title', before: 'Q3', after: 'Q4' }],
    ...over,
  }) as ChangeRequest;

const show = (over: Partial<ChangeRequest> = {}) =>
  render(
    <DiscardChangesModal
      changeRequest={changeRequest(over)}
      open
      onClose={() => {}}
      onConfirm={() => {}}
    />,
    { useRedux: true },
  );

test('the author is addressed as themselves, not described', () => {
  show({ is_author: true });

  expect(screen.getByText('Discard your changes?')).toBeInTheDocument();
  expect(screen.queryByText("Discard Alex Rivera's changes?")).toBeNull();
  expect(
    screen.getByText(/This deletes 1 change you made/),
  ).toBeInTheDocument();
});

test('the author is not told what they will see in their own history', () => {
  show({ is_author: true });

  expect(screen.queryByText(/Approvals history/)).toBeNull();
});

test('another editor is still told whose work this is', () => {
  show({ is_author: false });

  expect(screen.getByText("Discard Alex Rivera's changes?")).toBeInTheDocument();
  expect(
    screen.getByText(/This deletes 1 change Alex Rivera made/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Approvals history/)).toBeInTheDocument();
});

test('a request that does not say whose it is reads as somebody else', () => {
  // `is_author` is absent from list rows. Naming the author is the safe
  // reading of the two: it is merely formal when it is your own, and wrong
  // in a way that matters when it is not.
  show();

  expect(screen.getByText("Discard Alex Rivera's changes?")).toBeInTheDocument();
});
