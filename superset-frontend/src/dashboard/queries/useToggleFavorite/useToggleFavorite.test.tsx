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
import { QueryClientProvider } from '@tanstack/react-query';
import { SupersetClient } from '@superset-ui/core';
import {
  useDashboardStateStore,
  useDashboardInfoStore,
} from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { queryClient } from 'src/queries/queryClient';
import { dashboardKeys } from '../keys';
import { useToggleFavorite } from './useToggleFavorite';

jest.unmock('zustand');

const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addSuccessToast: jest.fn(),
    addDangerToast: mockAddDangerToast,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function setCurrentDashboard(id: number) {
  useDashboardInfoStore.setState({
    dashboardInfo: { id } as unknown as DashboardInfo,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useDashboardStateStore.setState({ isStarred: false });
});

test('sets starred when the dashboard ID still matches (starring)', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValue({} as never);

  const { result } = renderHook(() => useToggleFavorite(id), { wrapper });
  result.current.mutate(false);

  await waitFor(() =>
    expect(useDashboardStateStore.getState().isStarred).toBe(true),
  );
  expect(post).toHaveBeenCalledTimes(1);
  post.mockRestore();
});

test('clears starred when the dashboard ID still matches (unstarring)', async () => {
  const id = 123;
  setCurrentDashboard(id);
  useDashboardStateStore.setState({ isStarred: true });
  const del = jest
    .spyOn(SupersetClient, 'delete')
    .mockResolvedValue({} as never);

  const { result } = renderHook(() => useToggleFavorite(id), { wrapper });
  result.current.mutate(true);

  await waitFor(() =>
    expect(useDashboardStateStore.getState().isStarred).toBe(false),
  );
  expect(del).toHaveBeenCalledTimes(1);
  del.mockRestore();
});

test('syncs the favorite-status query cache with the new value on success', async () => {
  const id = 123;
  setCurrentDashboard(id);
  // Cache holds the pre-toggle value; the mutation must overwrite it so a
  // later Header remount does not mirror this stale value back into the store.
  queryClient.setQueryData(dashboardKeys.favoriteStatus(id), false);
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValue({} as never);

  const { result } = renderHook(() => useToggleFavorite(id), { wrapper });
  result.current.mutate(false);

  await waitFor(() =>
    expect(queryClient.getQueryData(dashboardKeys.favoriteStatus(id))).toBe(
      true,
    ),
  );
  post.mockRestore();
});

test('does NOT update starred when the dashboard ID changed before the response resolved', async () => {
  const requestedId = 123;
  setCurrentDashboard(456);
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValue({} as never);

  const { result } = renderHook(() => useToggleFavorite(requestedId), {
    wrapper,
  });
  result.current.mutate(false);

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(useDashboardStateStore.getState().isStarred).toBe(false);
  post.mockRestore();
});

test('still syncs the favorite-status cache when the dashboard changed before the response resolved', async () => {
  const requestedId = 123;
  setCurrentDashboard(456);
  // Stale pre-toggle value for the dashboard the user toggled then left; it must
  // still be corrected so a later visit doesn't mirror it back into the store.
  queryClient.setQueryData(dashboardKeys.favoriteStatus(requestedId), false);
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValue({} as never);

  const { result } = renderHook(() => useToggleFavorite(requestedId), {
    wrapper,
  });
  result.current.mutate(false);

  await waitFor(() =>
    expect(
      queryClient.getQueryData(dashboardKeys.favoriteStatus(requestedId)),
    ).toBe(true),
  );
  // The live store stays untouched because it reflects the current dashboard.
  expect(useDashboardStateStore.getState().isStarred).toBe(false);
  post.mockRestore();
});

test('shows a danger toast on error when the dashboard ID still matches', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockRejectedValue(new Error('network'));

  const { result } = renderHook(() => useToggleFavorite(id), { wrapper });
  result.current.mutate(false);

  await waitFor(() => expect(mockAddDangerToast).toHaveBeenCalledTimes(1));
  post.mockRestore();
});

test('does NOT show a danger toast on error when the dashboard ID changed', async () => {
  const requestedId = 123;
  setCurrentDashboard(456);
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockRejectedValue(new Error('network'));

  const { result } = renderHook(() => useToggleFavorite(requestedId), {
    wrapper,
  });
  result.current.mutate(false);

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(mockAddDangerToast).not.toHaveBeenCalled();
  post.mockRestore();
});
