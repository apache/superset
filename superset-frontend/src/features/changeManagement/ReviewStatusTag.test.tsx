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
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ReviewStatusTag from './ReviewStatusTag';

const ASSET_ENDPOINT = 'glob:*/api/v1/change_request/asset/dataset/7';

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('renders nothing without an open change', () => {
  render(<ReviewStatusTag assetType="dataset" assetId={7} />, {
    useRedux: true,
    useRouter: true,
  });
  expect(screen.queryByTestId('review-status-tag')).not.toBeInTheDocument();
});

test('stays plain text when it is not told which asset it belongs to', () => {
  render(<ReviewStatusTag status="pending" />, {
    useRedux: true,
    useRouter: true,
  });
  expect(screen.getByTestId('review-status-tag')).toHaveTextContent(
    'Awaiting review',
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('clicking the tag opens the change request page', async () => {
  fetchMock.get(ASSET_ENDPOINT, { result: { id: 42 } });
  render(<ReviewStatusTag status="draft" assetType="dataset" assetId={7} />, {
    useRedux: true,
    useRouter: true,
  });

  await userEvent.click(
    screen.getByRole('link', { name: 'Changes pending' }),
  );

  // The tag opens the list, which is the one way in now: it reviews a
  // dashboard or chart on the asset, and a dataset in place.
  await waitFor(() => expect(window.location.pathname).toBe('/approvals/'));
});
