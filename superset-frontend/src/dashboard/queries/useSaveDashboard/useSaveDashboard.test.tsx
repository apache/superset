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
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { useDashboardStateStore } from 'src/dashboard/stores';
import { useSaveDashboard } from './useSaveDashboard';

// Mock the underlying Redux thunk so we can control its resolution.
const mockThunkRun = jest.fn();
jest.mock('src/dashboard/actions/dashboardState', () => ({
  saveDashboardRequest:
    (data: any, id: number, saveType: string) =>
    // Returns a thunk; configureStore's thunk middleware invokes it.
    () =>
      mockThunkRun(data, id, saveType),
}));

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = configureStore({ reducer: { noop: (s = {}) => s } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  mockThunkRun.mockReset();
});

test('exposes isPending while the save is in flight', async () => {
  const { wrapper } = setup();
  let resolveSave: (v?: unknown) => void = () => {};
  mockThunkRun.mockReturnValueOnce(
    new Promise(resolve => {
      resolveSave = resolve;
    }),
  );

  const { result } = renderHook(() => useSaveDashboard(), { wrapper });

  act(() => {
    result.current.mutate({ data: {}, id: 6, saveType: 'overwrite' });
  });

  await waitFor(() => expect(result.current.isPending).toBe(true));

  act(() => {
    resolveSave({ ok: true });
  });

  await waitFor(() => expect(result.current.isPending).toBe(false));
});

// Cache invalidation and snapshot dropping live in the saveDashboardRequest
// thunk and are verified in dashboardState.test.ts.

test('exits edit mode on save success (QA Finding F)', async () => {
  const { wrapper } = setup();
  mockThunkRun.mockResolvedValueOnce({ ok: true });
  useDashboardStateStore.setState({ editMode: true });

  const { result } = renderHook(() => useSaveDashboard(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      data: {},
      id: 7,
      saveType: 'overwrite',
    });
  });

  expect(useDashboardStateStore.getState().editMode).toBe(false);
});

test('passes through data/id/saveType to the underlying thunk', async () => {
  const { wrapper } = setup();
  mockThunkRun.mockResolvedValueOnce({ ok: true });

  const { result } = renderHook(() => useSaveDashboard(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      data: { dashboard_title: 'X' },
      id: 7,
      saveType: 'overwrite',
    });
  });

  expect(mockThunkRun).toHaveBeenCalledWith(
    { dashboard_title: 'X' },
    7,
    'overwrite',
  );
});

test('stays in edit mode when the overwrite precheck defers the save', async () => {
  const { wrapper } = setup();
  // The thunk resolves without a response when the precheck opens the
  // OverwriteConfirm modal instead of saving.
  mockThunkRun.mockResolvedValueOnce(undefined);
  useDashboardStateStore.setState({ editMode: true });

  const { result } = renderHook(() => useSaveDashboard(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      data: {},
      id: 7,
      saveType: 'overwrite',
    });
  });

  expect(useDashboardStateStore.getState().editMode).toBe(true);
});

test('does NOT exit edit mode when the save thunk rejects', async () => {
  const { wrapper } = setup();
  mockThunkRun.mockRejectedValueOnce(new Error('Network 500'));
  useDashboardStateStore.setState({ editMode: true });

  const { result } = renderHook(() => useSaveDashboard(), { wrapper });
  await act(async () => {
    try {
      await result.current.mutateAsync({
        data: {},
        id: 7,
        saveType: 'overwrite',
      });
    } catch {
      // Expected — the mutation rejects so the test catch is intentional.
    }
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(useDashboardStateStore.getState().editMode).toBe(true);
});
