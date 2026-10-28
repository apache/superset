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
 * @fileoverview Asking for a review, when there may be nobody to ask.
 *
 * SOW 5.4: an author cannot approve their own change, so a request needs a
 * second editor. The server enforces that with a 422, and the dialog knows
 * it too -- it lists who can approve, and says so when the list is empty.
 */
import fetchMock from 'fetch-mock';
import { render, screen } from 'spec/helpers/testing-library';
import RequestReviewModal from './RequestReviewModal';
import type { ChangeRequest } from './types';

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/dataset/related/editors*', { result: [] });
  fetchMock.get('glob:*/api/v1/dataset/7', { result: { editors: [] } });
});

afterAll(() => fetchMock.clearHistory().removeRoutes());

const request = (over: Partial<ChangeRequest> = {}) =>
  ({
    id: 1,
    asset_type: 'dataset',
    asset_id: 7,
    status: 'draft',
    note: '',
    eligible_approvers: [],
    ...over,
  }) as ChangeRequest;

const show = (changeRequest: ChangeRequest) =>
  render(
    <RequestReviewModal
      changeRequest={changeRequest}
      open
      onClose={() => {}}
      onSubmit={() => {}}
    />,
    { useRedux: true, useRouter: true },
  );

test('Request review is disabled when nobody else can approve', async () => {
  // The server answers 422 here. Pressing the button to be told that is a
  // worse way to learn it than the button being plainly unavailable (QA-20).
  show(request({ eligible_approvers: [] }));

  const button = await screen.findByRole('button', { name: 'Request review' });
  expect(button).toBeDisabled();
});

test('the dialog says why, next to the button it disabled', async () => {
  show(request({ eligible_approvers: [] }));

  expect(
    await screen.findByText(/No one else can approve this/),
  ).toBeInTheDocument();
});

test('Request review is available once someone can approve', async () => {
  show(
    request({
      eligible_approvers: [
        { id: 2, first_name: 'Priya', last_name: 'Shah', username: 'priya' },
      ],
    } as Partial<ChangeRequest>),
  );

  const button = await screen.findByRole('button', { name: 'Request review' });
  expect(button).toBeEnabled();
});
