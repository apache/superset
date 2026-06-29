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
import { usePublishDashboard } from './usePublishDashboard';

jest.unmock('zustand');

const mockAddSuccessToast = jest.fn();
const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addSuccessToast: mockAddSuccessToast,
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
  useDashboardStateStore.setState({ isPublished: false });
});

test('sets published and shows a success toast when the dashboard ID still matches', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const put = jest.spyOn(SupersetClient, 'put').mockResolvedValue({} as never);

  const { result } = renderHook(() => usePublishDashboard(id), { wrapper });
  result.current.mutate(true);

  await waitFor(() =>
    expect(useDashboardStateStore.getState().isPublished).toBe(true),
  );
  expect(mockAddSuccessToast).toHaveBeenCalledTimes(1);
  put.mockRestore();
});

test('rebaselines the discard snapshot on publish so a later discard stays in-place', async () => {
  const id = 123;
  setCurrentDashboard(id);
  queryClient.setQueryData(dashboardKeys.hydrationPayload(id), {
    dashboardInfo: { id },
    dashboardLayout: { present: {} },
    sliceEntities: { slices: {} },
    zustandStateSeed: { isPublished: false },
  });
  const put = jest.spyOn(SupersetClient, 'put').mockResolvedValue({} as never);

  const { result } = renderHook(() => usePublishDashboard(id), { wrapper });
  result.current.mutate(true);

  await waitFor(() =>
    expect(useDashboardStateStore.getState().isPublished).toBe(true),
  );
  const snapshot = queryClient.getQueryData(
    dashboardKeys.hydrationPayload(id),
  ) as { zustandStateSeed: { isPublished: boolean } };
  expect(snapshot.zustandStateSeed.isPublished).toBe(true);
  put.mockRestore();
});

test('does NOT update when the dashboard ID changed before the response resolved', async () => {
  const requestedId = 123;
  setCurrentDashboard(456);
  const put = jest.spyOn(SupersetClient, 'put').mockResolvedValue({} as never);

  const { result } = renderHook(() => usePublishDashboard(requestedId), {
    wrapper,
  });
  result.current.mutate(true);

  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(mockAddSuccessToast).not.toHaveBeenCalled();
  expect(useDashboardStateStore.getState().isPublished).toBe(false);
  put.mockRestore();
});

test('shows a danger toast on error when the dashboard ID still matches', async () => {
  const id = 123;
  setCurrentDashboard(id);
  const put = jest
    .spyOn(SupersetClient, 'put')
    .mockRejectedValue(new Error('forbidden'));

  const { result } = renderHook(() => usePublishDashboard(id), { wrapper });
  result.current.mutate(true);

  await waitFor(() => expect(mockAddDangerToast).toHaveBeenCalledTimes(1));
  put.mockRestore();
});

test('does NOT show a danger toast on error when the dashboard ID changed', async () => {
  const requestedId = 123;
  setCurrentDashboard(456);
  const put = jest
    .spyOn(SupersetClient, 'put')
    .mockRejectedValue(new Error('forbidden'));

  const { result } = renderHook(() => usePublishDashboard(requestedId), {
    wrapper,
  });
  result.current.mutate(true);

  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(mockAddDangerToast).not.toHaveBeenCalled();
  put.mockRestore();
});
