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
import { render } from 'spec/helpers/testing-library';
import { AutoRefreshProvider } from 'src/dashboard/contexts/AutoRefreshContext';
import {
  useDashboardInfoStore,
  useDashboardStateStore,
} from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import HeadlessAutoRefresh from './HeadlessAutoRefresh';

const mockUseHeaderAutoRefresh = jest.fn();

jest.mock('./useHeaderAutoRefresh', () => ({
  useHeaderAutoRefresh: (props: unknown) => {
    mockUseHeaderAutoRefresh(props);
    return {
      forceRefresh: jest.fn(),
      handlePauseToggle: jest.fn(),
      autoRefreshPauseOnInactiveTab: false,
      setPauseOnInactiveTab: jest.fn(),
    };
  },
}));

// isLoading is still derived from the (Redux) charts slice.
const reduxState = {
  charts: {
    1: { id: 1, chartUpdateStartTime: 0, chartUpdateEndTime: 0 },
    2: { id: 2, chartUpdateStartTime: 0, chartUpdateEndTime: 0 },
  },
};

// Auto-refresh config (dashboard id/metadata, slice ids, refresh frequency)
// now lives in the Zustand dashboard stores, not Redux.
const seedStores = (refreshFrequency = 30) => {
  useDashboardInfoStore.setState({
    dashboardInfo: {
      id: 42,
      metadata: { timed_refresh_immune_slices: [7] },
      common: { conf: { DASHBOARD_AUTO_REFRESH_MODE: 'fetch' } },
    } as unknown as DashboardInfo,
  });
  useDashboardStateStore.setState({ refreshFrequency, sliceIds: [1, 2, 3] });
};

beforeEach(() => {
  mockUseHeaderAutoRefresh.mockClear();
});

test('drives the auto-refresh hook from dashboard state without a header', () => {
  seedStores(30);
  const { container } = render(
    <AutoRefreshProvider>
      <HeadlessAutoRefresh />
    </AutoRefreshProvider>,
    { useRedux: true, initialState: reduxState },
  );

  // The component renders nothing but must still start the refresh timer.
  expect(container).toBeEmptyDOMElement();
  expect(mockUseHeaderAutoRefresh).toHaveBeenCalledTimes(1);
  expect(mockUseHeaderAutoRefresh).toHaveBeenCalledWith(
    expect.objectContaining({
      chartIds: [1, 2, 3],
      dashboardId: 42,
      refreshFrequency: 30,
      timedRefreshImmuneSlices: [7],
      autoRefreshMode: 'fetch',
      isLoading: false,
      onRefresh: expect.any(Function),
      setRefreshFrequency: expect.any(Function),
      logEvent: expect.any(Function),
    }),
  );
});

test('passes the refresh frequency through to the hook', () => {
  seedStores(0);
  render(
    <AutoRefreshProvider>
      <HeadlessAutoRefresh />
    </AutoRefreshProvider>,
    { useRedux: true, initialState: reduxState },
  );

  expect(mockUseHeaderAutoRefresh).toHaveBeenCalledWith(
    expect.objectContaining({ refreshFrequency: 0 }),
  );
});
