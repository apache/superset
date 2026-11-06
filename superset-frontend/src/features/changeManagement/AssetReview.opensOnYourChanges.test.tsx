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
 * The author opens on their own changes, not on the published asset.
 *
 * This is the behaviour the lost edits came from. Edit mode loads nothing --
 * it sets one boolean -- so whatever the page is showing is what gets
 * edited. While the page opened on live, an author who pressed Edit was
 * handed the published dashboard, and their next save posted it over the
 * draft they had been building.
 *
 * The overlay is unchanged; only which side rests on screen is. Pinned
 * here because the change was otherwise asserted nowhere, and a later
 * reading of "the author sees the live version" could quietly put it back.
 */
import { render, waitFor } from 'spec/helpers/testing-library';
import AssetReview from './AssetReview';
import type { ChangeRequest } from './types';

const mockUseAssetReview = jest.fn();
jest.mock('./useAssetReview', () => ({
  useAssetReview: (...args: unknown[]) => mockUseAssetReview(...args),
}));
jest.mock('./ReviewBanner', () => () => <div data-test="banner" />);
jest.mock('./WhatChangedPanel', () => () => null);

const toggle = jest.fn();
const mockPreview = jest.fn();
jest.mock('./useProposedPreview', () => ({
  useProposedPreview: (...args: unknown[]) => mockPreview(...args),
}));

const change = (over: Record<string, unknown> = {}) =>
  ({
    id: 9,
    asset_type: 'dashboard',
    asset_id: 6,
    status: 'draft',
    is_open: true,
    is_author: true,
    can_approve: false,
    operation: 'update',
    command: null,
    changed_fields: ['json_metadata'],
    ...over,
  }) as unknown as ChangeRequest;

beforeEach(() => {
  toggle.mockReset();
  mockPreview.mockReset();
  mockUseAssetReview.mockReset();
  mockPreview.mockReturnValue({
    canPreview: true,
    showing: false,
    busy: false,
    toggle,
  });
  mockUseAssetReview.mockReturnValue({
    changeRequest: change(),
    refresh: jest.fn(),
  });
});

const mount = (assetType: 'dashboard' | 'chart' = 'dashboard') =>
  render(<AssetReview assetType={assetType} assetId={6} />, {
    useRedux: true,
    useRouter: true,
  });

test('the author’s own open change opens showing their changes', async () => {
  mount();

  await waitFor(() => expect(toggle).toHaveBeenCalledWith(true));
});

test('somebody else’s change does not', async () => {
  // A reviewer opens on the live asset and reaches the proposal through the
  // switch. Defaulting them into it would mean deciding on a page that does
  // not show what viewers currently have.
  mockUseAssetReview.mockReturnValue({
    changeRequest: change({ is_author: false }),
    refresh: jest.fn(),
  });
  mount();

  await waitFor(() => expect(mockPreview).toHaveBeenCalled());
  expect(toggle).not.toHaveBeenCalled();
});

test('a change that is no longer open does not', async () => {
  mockUseAssetReview.mockReturnValue({
    changeRequest: change({ is_open: false, status: 'approved' }),
    refresh: jest.fn(),
  });
  mount();

  await waitFor(() => expect(mockPreview).toHaveBeenCalled());
  expect(toggle).not.toHaveBeenCalled();
});

test('it does not fight an author who switched to live themselves', async () => {
  // Once per change, not once per render. Without this the switch would
  // snap back on the next render and the author could never see live.
  const { rerender } = mount();
  await waitFor(() => expect(toggle).toHaveBeenCalledTimes(1));

  mockPreview.mockReturnValue({
    canPreview: true,
    showing: false,
    busy: false,
    toggle,
  });
  rerender(<AssetReview assetType="dashboard" assetId={6} />);

  expect(toggle).toHaveBeenCalledTimes(1);
});

test('a chart is left alone, because Explore already did it', async () => {
  // Not a gap any more, and not something to "fix" here later. Explore
  // opens the author on their draft at bootstrap instead, in
  // `pages/Chart`, where the proposal becomes the form data every control
  // and the chart entry are built from (sc-131032).
  //
  // Doing it from here as well would be the version that does not work:
  // seeding after the page has built its store is what crashed the chart
  // panel on an undefined `chartStatus`, three times. And the overlay this
  // effect drives is the reviewer's preview, drawn as an unsaved chart --
  // turning it on for the author would put a second copy of their own work
  // in front of them.
  mount('chart');

  await waitFor(() => expect(mockPreview).toHaveBeenCalled());
  expect(toggle).not.toHaveBeenCalled();
});

test('nothing happens when there is no overlay to show', async () => {
  // Filter, colour and customization changes carry payload shapes that
  // cannot be laid over the asset, so there is nothing to default to.
  mockPreview.mockReturnValue({
    canPreview: false,
    showing: false,
    busy: false,
    toggle,
  });
  mount();

  await waitFor(() => expect(mockPreview).toHaveBeenCalled());
  expect(toggle).not.toHaveBeenCalled();
});
