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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import {
  VersionHistoryProvider,
  useOptionalVersionHistory,
} from '../context/VersionHistoryContext';

// Stand-in for what ``DashboardPreviewBanner`` actually does:
// ``useOptionalVersionHistory()`` then call ``ctx?.exitPreview()`` on
// click. Isolates the architectural concern (does the banner see the
// provider?) without requiring redux + version-list mocks.
function PreviewExitStandIn() {
  const ctx = useOptionalVersionHistory();
  return (
    <button
      type="button"
      data-test="exit-stand-in"
      onClick={() => ctx?.exitPreview()}
    >
      exit
    </button>
  );
}

const PREVIEW_UUID = '11111111-2222-3333-4444-555555555555';

function setPreviewUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('version_uuid', PREVIEW_UUID);
  window.history.replaceState(window.history.state, '', url.toString());
}

function clearPreviewUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('version_uuid');
  window.history.replaceState(window.history.state, '', url.toString());
}

afterEach(() => {
  clearPreviewUrl();
});

test('Close preview clears ?version_uuid when the banner is inside the provider', () => {
  // The architectural fix: with ``VersionHistoryProvider`` lifted above
  // both Header and DashboardBuilder, the banner now sees the live
  // context — ``ctx.exitPreview()`` clears the preview state, and the
  // provider's URL-write effect strips ``?version_uuid``.
  setPreviewUrl();
  expect(new URL(window.location.href).searchParams.get('version_uuid')).toBe(
    PREVIEW_UUID,
  );
  render(
    <VersionHistoryProvider>
      <PreviewExitStandIn />
    </VersionHistoryProvider>,
  );
  fireEvent.click(screen.getByTestId('exit-stand-in'));
  expect(
    new URL(window.location.href).searchParams.get('version_uuid'),
  ).toBeNull();
});

test('Close preview is a silent no-op when the banner is outside the provider', () => {
  // Regression pinning the previously-shipped bug: when the banner is
  // a sibling of the provider (the pre-lift shape), the optional hook
  // falls back to its no-op stub. The click reaches the button but
  // ``ctx?.exitPreview()`` does nothing and the URL is unchanged.
  // Future refactors that accidentally re-introduce the sibling shape
  // will fail this test.
  setPreviewUrl();
  expect(new URL(window.location.href).searchParams.get('version_uuid')).toBe(
    PREVIEW_UUID,
  );
  render(<PreviewExitStandIn />);
  fireEvent.click(screen.getByTestId('exit-stand-in'));
  // URL still pinned — proves the bug we're fixing.
  expect(new URL(window.location.href).searchParams.get('version_uuid')).toBe(
    PREVIEW_UUID,
  );
});
