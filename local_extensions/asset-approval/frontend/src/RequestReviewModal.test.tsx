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
 * QA-20: what the dialog offers when nobody else can approve.
 *
 * Core asserted this and the file was deleted with the screens it tested,
 * so the extension's copy of the dialog went on rendering the explanation
 * beside a live button. The server refuses the submit with 422, which
 * means the author pressed it only to be told the same thing in a worse
 * place.
 *
 * This file is also what stops `test_a_screen_row_is_not_held_up_by_a_
 * backend_test` failing on QA-20: the row had a backend test asserting the
 * refusal, and nothing asserting the button.
 */

import { render, screen, waitFor } from '@testing-library/react';
import RequestReviewModal from './RequestReviewModal';
import type { ChangeRequest, UserBrief } from './types';

jest.mock('./api', () => ({
  fetchEditorOptions: jest.fn().mockResolvedValue([]),
  fetchAssetEditorIds: jest.fn().mockResolvedValue([]),
  saveEditors: jest.fn().mockResolvedValue(undefined),
}));

const PRIYA: UserBrief = {
  id: 8,
  username: 'priya',
  first_name: 'Priya',
  last_name: 'Shah',
};

const request = (approvers: UserBrief[]) =>
  ({
    id: 1,
    asset_type: 'chart',
    asset_id: 42,
    status: 'draft',
    is_open: true,
    note: '',
    eligible_approvers: approvers,
  }) as unknown as ChangeRequest;

const show = (changeRequest: ChangeRequest) =>
  render(
    <RequestReviewModal
      changeRequest={changeRequest}
      open
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

/**
 * The dialog's primary button, by the name a person reads on it.
 *
 * Not by `data-test`: the two copies of `host.tsx` build this dialog
 * differently -- one marks the button, the other hands `disabled` to
 * antd's own OK button -- and the thing being asserted is what the author
 * can press, which is the same question either way.
 */
const confirmButton = () =>
  screen.getByRole('button', { name: 'Request review' });

test('[QA-20] Request review is not offered when nobody else can approve', async () => {
  show(request([]));

  await waitFor(() => expect(confirmButton()).toBeDisabled());
});

test('[QA-20] the dialog says why, beside the button it disabled', async () => {
  // The sentence alone was never the problem; the sentence next to a live
  // button was. Both halves are asserted together so neither can drift off
  // on its own.
  show(request([]));

  expect(
    await screen.findByText(
      'No one else can approve this chart. Add another editor to submit.',
    ),
  ).toBeInTheDocument();
  expect(confirmButton()).toBeDisabled();
});

test('[QA-20] and it is offered once somebody can', async () => {
  show(request([PRIYA]));

  await waitFor(() => expect(confirmButton()).toBeEnabled());
  expect(screen.getByText(/Priya Shah/)).toBeInTheDocument();
});
