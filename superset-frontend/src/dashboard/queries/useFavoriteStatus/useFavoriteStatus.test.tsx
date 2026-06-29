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
import { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupersetClient } from '@superset-ui/core';
import {
  useDashboardStateStore,
  useDashboardInfoStore,
} from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { useFavoriteStatus } from './useFavoriteStatus';

jest.unmock('zustand');

const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addSuccessToast: jest.fn(),
    addDangerToast: mockAddDangerToast,
  }),
}));

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

function setCurrentDashboard(id: number) {
  useDashboardInfoStore.setState({
    dashboardInfo: { id } as unknown as DashboardInfo,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useDashboardStateStore.setState({ isStarred: false });
});

test('updates the starred state when the dashboard ID still matches', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const get = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [{ value: true }] },
  } as never);

  const { wrapper } = setup();
  renderHook(() => useFavoriteStatus(id), { wrapper });

  await waitFor(() =>
    expect(useDashboardStateStore.getState().isStarred).toBe(true),
  );
  get.mockRestore();
});

test('does NOT update the starred state when the dashboard ID changed before the response resolved', async () => {
  const requestedId = 123;
  setCurrentDashboard(456);
  const get = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [{ value: true }] },
  } as never);

  const { wrapper } = setup();
  renderHook(() => useFavoriteStatus(requestedId), { wrapper });

  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  expect(useDashboardStateStore.getState().isStarred).toBe(false);
  get.mockRestore();
});

test('shows a danger toast on error when the dashboard ID still matches', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(new Error('network'));

  const { wrapper } = setup();
  renderHook(() => useFavoriteStatus(id), { wrapper });

  await waitFor(() => expect(mockAddDangerToast).toHaveBeenCalledTimes(1));
  get.mockRestore();
});

test('does NOT show a danger toast on error when the dashboard ID changed', async () => {
  const requestedId = 123;
  setCurrentDashboard(456);
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(new Error('network'));

  const { wrapper } = setup();
  renderHook(() => useFavoriteStatus(requestedId), { wrapper });

  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  expect(mockAddDangerToast).not.toHaveBeenCalled();
  get.mockRestore();
});

test('does NOT show a danger toast on a 404 error when the dashboard ID still matches', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValue(
      new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }),
    );

  const { wrapper } = setup();
  renderHook(() => useFavoriteStatus(id), { wrapper });

  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  expect(mockAddDangerToast).not.toHaveBeenCalled();
  get.mockRestore();
});

test('shows a danger toast on a non-404 error Response when the dashboard ID still matches', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const get = jest.spyOn(SupersetClient, 'get').mockRejectedValue(
    new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
    }),
  );

  const { wrapper } = setup();
  renderHook(() => useFavoriteStatus(id), { wrapper });

  await waitFor(() => expect(mockAddDangerToast).toHaveBeenCalledTimes(1));
  get.mockRestore();
});

test('does not fetch when disabled', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const get = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: [{ value: true }] },
  } as never);

  const { wrapper } = setup();
  renderHook(() => useFavoriteStatus(id, false), { wrapper });

  // Give any potential async fetch a tick to fire.
  await Promise.resolve();
  expect(get).not.toHaveBeenCalled();
  get.mockRestore();
});
