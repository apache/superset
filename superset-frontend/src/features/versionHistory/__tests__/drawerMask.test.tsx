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
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import { VersionHistoryProvider } from '../context/VersionHistoryContext';

jest.mock('../hooks/useActivity', () => ({
  useActivity: () => ({
    records: [],
    count: 0,
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock('../hooks/useRestoreVersion', () => ({
  useRestoreVersion: () => ({ restore: jest.fn(), restoring: false }),
}));

function openPanelViaUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('version_uuid', '11111111-2222-3333-4444-555555555555');
  window.history.replaceState(window.history.state, '', url.toString());
}

function clearPanelUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('version_uuid');
  window.history.replaceState(window.history.state, '', url.toString());
}

afterEach(() => {
  clearPanelUrl();
});

test('VersionHistoryPanel renders the drawer with no backdrop mask', async () => {
  // The antd <Drawer> default mask is a full-viewport overlay that swallows
  // clicks aimed at the preview banner buttons (verified live: the mask is
  // the topmost element under banner-button coordinates). Pinning
  // ``mask={false}`` here lets banner / chart / dashboard clicks fall
  // through to the underlying handlers.
  openPanelViaUrl();
  render(
    <VersionHistoryProvider>
      <VersionHistoryPanel entityType="dashboard" uuid="dash-uuid" />
    </VersionHistoryProvider>,
    { useRedux: true, useRouter: true },
  );
  await waitFor(() => {
    expect(document.querySelector('.ant-drawer')).toBeInTheDocument();
  });
  // antd 5 omits the mask element entirely when ``mask={false}``. If
  // someone re-enables it the assertion below fails — and the banner
  // clicks regress.
  expect(document.querySelector('.ant-drawer-mask')).toBeNull();
});
