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
import { render, waitFor } from 'spec/helpers/testing-library';
import AssetReview from './AssetReview';
import type { ChangeRequest } from './types';

const mockUseAssetReview = jest.fn();
jest.mock('./useAssetReview', () => ({
  useAssetReview: (...args: unknown[]) => mockUseAssetReview(...args),
}));
// The banner and the panels are not what this file is about, and each pulls
// in a page's worth of chrome.
jest.mock('./ReviewBanner', () => () => <div data-test="banner" />);
jest.mock('./WhatChangedPanel', () => () => null);
const mockPreview = jest.fn();
jest.mock('./useProposedPreview', () => ({
  useProposedPreview: () => mockPreview(),
}));

const changeRequest = (asset_title: string | null) =>
  ({
    id: 1,
    asset_type: 'dashboard',
    asset_id: 6,
    asset_title,
    status: 'draft',
    is_open: true,
    is_author: true,
    can_approve: false,
    changed_fields: ['dashboard_title'],
  }) as unknown as ChangeRequest;

beforeEach(() => {
  mockUseAssetReview.mockReset();
  mockPreview.mockReset();
  // The whole surface the hook returns. `toggle` is reached now that the
  // author's own change opens on their changes rather than on live.
  mockPreview.mockReturnValue({
    canPreview: true,
    showing: false,
    busy: false,
    toggle: jest.fn(),
  });
});

test('the asset’s live title is reported to the host', async () => {
  // A dashboard lets the author edit its title in place, so after a captured
  // save the header still shows the proposal while the banner beside it says
  // viewers and author are both on the live version. The host puts the header
  // back, and this is how it learns what to put back to.
  mockUseAssetReview.mockReturnValue({
    changeRequest: changeRequest('Sales Dashboard'),
    refresh: jest.fn(),
  });
  const onLiveTitle = jest.fn();

  render(<AssetReview assetType="dashboard" assetId={6} onLiveTitle={onLiveTitle} />, {
    useRedux: true,
  });

  await waitFor(() => expect(onLiveTitle).toHaveBeenCalledWith('Sales Dashboard'));
});

test('nothing is reported when the asset has no open change', async () => {
  mockUseAssetReview.mockReturnValue({ changeRequest: null, refresh: jest.fn() });
  const onLiveTitle = jest.fn();

  render(<AssetReview assetType="dashboard" assetId={6} onLiveTitle={onLiveTitle} />, {
    useRedux: true,
  });

  await waitFor(() => expect(onLiveTitle).not.toHaveBeenCalled());
});

test('a change request with no title reports nothing rather than an empty one', async () => {
  mockUseAssetReview.mockReturnValue({
    changeRequest: changeRequest(null),
    refresh: jest.fn(),
  });
  const onLiveTitle = jest.fn();

  render(<AssetReview assetType="dashboard" assetId={6} onLiveTitle={onLiveTitle} />, {
    useRedux: true,
  });

  await waitFor(() => expect(onLiveTitle).not.toHaveBeenCalled());
});

test('nothing is reported while Show changes is on', async () => {
  // That switch hydrates the whole dashboard from the proposal, title
  // included. Reporting the live title here would put the title straight
  // back, so the one thing the author turned the switch on to see would be
  // the one thing it did not show.
  mockUseAssetReview.mockReturnValue({
    changeRequest: changeRequest('Sales Dashboard'),
    refresh: jest.fn(),
  });
  mockPreview.mockReturnValue({ canPreview: true, showing: true });
  const onLiveTitle = jest.fn();

  render(<AssetReview assetType="dashboard" assetId={6} onLiveTitle={onLiveTitle} />, {
    useRedux: true,
  });

  await waitFor(() => expect(onLiveTitle).not.toHaveBeenCalled());
});
