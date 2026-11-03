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
 * @fileoverview What the author's banner claims is on screen.
 *
 * SOW 5.5: an author with an unsubmitted draft sees the live asset until
 * they turn Show changes on. The banner used to say "Viewing your changes"
 * regardless, which is the opposite of the truth before the switch is
 * flipped (QA-19).
 */
import { render, screen } from 'spec/helpers/testing-library';
import ReviewBanner from './ReviewBanner';
import type { ChangeRequest } from './types';

const draft = {
  id: 1,
  asset_type: 'dashboard',
  asset_id: 3,
  status: 'draft',
  is_author: true,
  changed_on: new Date().toISOString(),
  note: null,
} as unknown as ChangeRequest;

const show = (showChanges?: { showing: boolean }) =>
  render(
    <ReviewBanner
      changeRequest={draft}
      onShowWhatChanged={() => {}}
      onRequestReview={() => {}}
      {...(showChanges
        ? { showChanges: { ...showChanges, busy: false, toggle: () => {} } }
        : {})}
    />,
    { useRedux: true, useRouter: true },
  );

test('with the preview off, the banner says the live version is on screen', () => {
  show({ showing: false });

  expect(
    screen.getByText(/you and viewers are both seeing the live version/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/^Viewing your changes/)).not.toBeInTheDocument();
});

test('with the preview on, it says the author is viewing their changes', () => {
  show({ showing: true });

  expect(screen.getByText(/Viewing your changes/)).toBeInTheDocument();
});

test('where there is no preview at all, it says the live version is on screen', () => {
  // This used to assert the opposite, on the reasoning that an asset with
  // no in-place preview must be showing the author their own draft. That
  // holds for a dashboard, whose author keeps editing in place. It is false
  // for a chart: `canPreview` is dashboard-only, and after a held save
  // Explore reloads the live slice, so the author was told they were
  // viewing changes that were nowhere on screen (sc-131032).
  show(undefined);

  expect(
    screen.getByText(/you and viewers are both seeing the live version/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/^Viewing your changes/)).not.toBeInTheDocument();
});

test('with no preview it does not point at a switch that is not there', () => {
  show(undefined);

  expect(screen.queryByText(/turn on Show changes/)).not.toBeInTheDocument();
});

test('with the preview off it does point at the switch', () => {
  show({ showing: false });

  expect(screen.getByText(/turn on Show changes/)).toBeInTheDocument();
});
