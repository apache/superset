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
 * @fileoverview What the banner claims is on screen.
 *
 * SOW 5.5: an author with an unsubmitted draft sees the live asset until
 * they turn Show changes on. The banner used to say "Viewing your changes"
 * regardless, which is the opposite of the truth before the switch is
 * flipped (QA-19).
 *
 * The reviewer's line had the same fault for longer and more quietly: it
 * read the same with the switch on and off, so the one persistent
 * statement at the top of the page could not be used to tell the two
 * apart. Approving is not gated on having looked, so the expensive mistake
 * is a reviewer deciding on the live chart without ever flipping it.
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

const pending = {
  id: 2,
  asset_type: 'chart',
  asset_id: 9,
  status: 'pending',
  can_approve: true,
  is_author: false,
  author: { id: 3, first_name: 'Priya', last_name: 'Shah' },
  changed_fields: ['params'],
  submitted_at: new Date().toISOString(),
  changed_on: new Date().toISOString(),
  note: null,
} as unknown as ChangeRequest;

const showReviewer = (showing: boolean) =>
  render(
    <ReviewBanner
      changeRequest={pending}
      onShowWhatChanged={() => {}}
      onRequestReview={() => {}}
      showChanges={{ showing, busy: false, toggle: () => {} }}
    />,
    { useRedux: true, useRouter: true },
  );

test('the reviewer is told they are on the live version', () => {
  showReviewer(false);

  expect(
    screen.getByText(/Priya Shah proposed .* you are seeing the live version/),
  ).toBeInTheDocument();
});

test('the reviewer is told when they are on the proposal', () => {
  showReviewer(true);

  expect(
    screen.getByText(/Priya Shah proposed .* you are seeing the proposal/),
  ).toBeInTheDocument();
});

test("the reviewer's banner is not the same in both states", () => {
  // The structural half. The two assertions above would both pass against a
  // single string containing either phrase, and the bug was that one string
  // served both states.
  const off = showReviewer(false).container.textContent;
  const on = showReviewer(true).container.textContent;

  expect(off).not.toEqual(on);
});
