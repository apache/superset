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
import { announceChangeCaptured, announceReviewChanged } from './events';
import { useAssetReview, useOpenChange } from './useAssetReview';

const ASSET_ENDPOINT = 'glob:*/api/v1/change_request/asset/dashboard/3';
const originalFlags = window.featureFlags;

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
  // A tab remembers the decided requests it has already withheld, so each
  // test starts as a tab that has withheld nothing.
  window.sessionStorage.clear();
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

describe('the decided-request nudge', () => {
  /**
   * `for_asset` has a deliberate fallback: with nothing open on the asset,
   * it serves the reader their own recently approved request instead
   * (RECENTLY_DECIDED, twelve hours). An approval is otherwise silent, and
   * the author finds out by opening the dashboard later and noticing it has
   * changed, so the window is wanted.
   *
   * What is not wanted is the fallback firing on the re-read taken straight
   * after the author discarded a *different* change. The banner flipped to
   * "Priya Shah approved your change · it is live for viewers" beside a
   * "Changes discarded." toast, which reads as though the discard had
   * published something.
   */
  const open = (over: Record<string, unknown> = {}) => ({
    result: {
      id: 9,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'draft',
      is_open: true,
      is_author: true,
      ...over,
    },
  });

  const decided = (id: number) => ({
    result: {
      id,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'approved',
      is_open: false,
      is_author: true,
      decided_at: new Date().toISOString(),
    },
  });

  test('an older decision is withheld when the change we were following goes', async () => {
    fetchMock.get(ASSET_ENDPOINT, open());

    render(<Probe />, { useRedux: true, useRouter: true });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('draft'),
    );

    // The author discards. Nothing is open any more, so the server offers
    // the earlier approved request in its place.
    fetchMock.removeRoutes();
    fetchMock.get(ASSET_ENDPOINT, decided(4));
    announceReviewChanged();

    await waitFor(() =>
      expect(fetchMock.callHistory.calls(ASSET_ENDPOINT)).toHaveLength(2),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('none');
  });

  test('and stays withheld on the reads after it', async () => {
    fetchMock.get(ASSET_ENDPOINT, open());

    render(<Probe />, { useRedux: true, useRouter: true });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('draft'),
    );

    fetchMock.removeRoutes();
    fetchMock.get(ASSET_ENDPOINT, decided(4));
    announceReviewChanged();
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('none'),
    );

    announceChangeCaptured();
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(ASSET_ENDPOINT)).toHaveLength(3),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('none');
  });

  test('the change we were following being approved is still the news', async () => {
    // Keyed on the id, not the status: this is exactly what the window
    // exists to carry, and the request keeps its id across the decision.
    fetchMock.get(ASSET_ENDPOINT, open({ status: 'pending' }));

    render(<Probe />, { useRedux: true, useRouter: true });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('pending'),
    );

    fetchMock.removeRoutes();
    fetchMock.get(ASSET_ENDPOINT, decided(9));
    announceReviewChanged();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('approved'),
    );
  });

  test('a decision found on arrival is shown, because nothing was followed', async () => {
    fetchMock.get(ASSET_ENDPOINT, decided(4));

    render(<Probe />, { useRedux: true, useRouter: true });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('approved'),
    );
  });
});

test('a withheld decision stays withheld after the host reloads the page', async () => {
  // The host reloads on an applied action -- `onApplied` is
  // `window.location.reload` in DashboardBuilder -- so the page that
  // discarded the draft is not the page that is handed the leftover. A
  // guard that lived only in the component's own state fixed nothing a
  // user could see: the banner came straight back as "Priya Shah approved
  // your change · it is live for viewers" under a freshly reloaded
  // dashboard. Re-mounting is as close as this test gets to that reload.
  fetchMock.get(ASSET_ENDPOINT, {
    result: {
      id: 9,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'draft',
      is_open: true,
      is_author: true,
    },
  });

  const first = render(<Probe />, { useRedux: true, useRouter: true });

  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('draft'),
  );

  fetchMock.removeRoutes();
  fetchMock.get(ASSET_ENDPOINT, {
    result: {
      id: 4,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'approved',
      is_open: false,
      is_author: true,
      decided_at: new Date().toISOString(),
    },
  });
  announceReviewChanged();

  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('none'),
  );

  first.unmount();
  render(<Probe />, { useRedux: true, useRouter: true });

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(ASSET_ENDPOINT).length).toBeGreaterThan(
      2,
    ),
  );
  expect(screen.getByTestId('status')).toHaveTextContent('none');
});

test('a later approval on the same asset is still news after one was withheld', async () => {
  // Remembered by id, not by a cutoff time: the author discards, comes
  // back, submits again, and that one is approved. Its nudge is the whole
  // point of the window.
  fetchMock.get(ASSET_ENDPOINT, {
    result: {
      id: 9,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'draft',
      is_open: true,
      is_author: true,
    },
  });

  const first = render(<Probe />, { useRedux: true, useRouter: true });
  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('draft'),
  );

  fetchMock.removeRoutes();
  fetchMock.get(ASSET_ENDPOINT, {
    result: {
      id: 4,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'approved',
      is_open: false,
      is_author: true,
    },
  });
  announceReviewChanged();
  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('none'),
  );

  first.unmount();
  fetchMock.removeRoutes();
  fetchMock.get(ASSET_ENDPOINT, {
    result: {
      id: 12,
      asset_type: 'dashboard',
      asset_id: 3,
      status: 'approved',
      is_open: false,
      is_author: true,
    },
  });
  render(<Probe />, { useRedux: true, useRouter: true });

  await waitFor(() =>
    expect(screen.getByTestId('status')).toHaveTextContent('approved'),
  );
});
