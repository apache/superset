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
 * @fileoverview The bounce-back path: request changes, fix, resubmit.
 *
 * A reviewer presses Request changes; the author edits and saves. The
 * backend returns the bounced request to the author's hands as a draft,
 * and the banner has to notice without a reload, or the author is left on
 * a screen with no way to resubmit (QA-14).
 */
import fetchMock from 'fetch-mock';
import { FeatureFlag } from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { announceChangeCaptured } from './events';
import { useAssetReview, useOpenChange } from './useAssetReview';

const ASSET_ENDPOINT = 'glob:*/api/v1/change_request/asset/dashboard/3';
const originalFlags = window.featureFlags;

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = originalFlags;
});

function Probe() {
  const { changeRequest } = useAssetReview('dashboard', 3);
  return <span data-test="status">{changeRequest?.status ?? 'none'}</span>;
}

test('a captured save moves the banner off changes_requested without a reload', async () => {
  fetchMock.get(ASSET_ENDPOINT, {
    result: {
      id: 5,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'changes_requested',
    },
  });

  render(<Probe />, { useRedux: true, useRouter: true });

  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('changes_requested'),
  );

  // The author saves their fix. The server returns the bounced request to
  // them as a draft, which is the state the Request review button lives in.
  fetchMock.removeRoutes();
  fetchMock.get(ASSET_ENDPOINT, {
    result: { id: 5, asset_type: 'dashboard', asset_id: 3, status: 'draft' },
  });
  announceChangeCaptured();

  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('draft'),
  );
});

test('nothing is read while review is switched off', async () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: false };
  fetchMock.get(ASSET_ENDPOINT, { result: { id: 5, status: 'draft' } });

  render(<Probe />, { useRedux: true, useRouter: true });

  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('none'),
  );
  expect(fetchMock.callHistory.calls(ASSET_ENDPOINT)).toHaveLength(0);
});

function OpenChangeProbe() {
  const changeRequest = useOpenChange('dashboard', 3);
  return <span data-test="open">{changeRequest?.status ?? 'none'}</span>;
}

test('the Request review action re-reads when a save is captured', async () => {
  // The banner refreshed and the action beside it did not, so after the
  // author saved a fix for a review that had been sent back there was no
  // way to send it on again without reloading the page (QA-14). The
  // button is drawn from this hook, not from the banner's.
  fetchMock.get(ASSET_ENDPOINT, {
    result: {
      id: 5,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'changes_requested',
    },
  });

  render(<OpenChangeProbe />, { useRedux: true, useRouter: true });

  await waitFor(() =>
    expect(screen.getByTestId('open')).toHaveTextContent('changes_requested'),
  );

  fetchMock.removeRoutes();
  fetchMock.get(ASSET_ENDPOINT, {
    result: { id: 5, asset_type: 'dashboard', asset_id: 3, status: 'draft' },
  });
  announceChangeCaptured();

  await waitFor(() =>
    expect(screen.getByTestId('open')).toHaveTextContent('draft'),
  );
});
