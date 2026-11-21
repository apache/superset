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
import { useDashboardInfoStore } from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { queryClient } from 'src/queries/queryClient';
import { useSaveCrossFiltersSetting } from './useSaveCrossFiltersSetting';

// Ported from the retired dashboardInfo action tests (#44623): only a
// SUCCESSFUL cross-filter scoping save may move the version-history revision.
jest.unmock('zustand');

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: jest.fn(), addSuccessToast: jest.fn() }),
}));

const wrapper = ({ children }: { children?: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  useDashboardInfoStore.setState({
    dashboardInfo: { id: 1, metadata: {} } as unknown as DashboardInfo,
    versionHistoryRevision: 0,
  });
});

afterEach(() => jest.restoreAllMocks());

test('a successful cross-filter scoping save bumps the version-history revision', async () => {
  jest.spyOn(SupersetClient, 'request').mockResolvedValue(
    new Response(
      JSON.stringify({
        result: { json_metadata: '{}' },
        last_modified_time: 123,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ) as unknown as Awaited<ReturnType<typeof SupersetClient.request>>,
  );

  const { result } = renderHook(() => useSaveCrossFiltersSetting(), {
    wrapper,
  });
  result.current.mutate(true);

  await waitFor(() =>
    expect(useDashboardInfoStore.getState().versionHistoryRevision).toBe(1),
  );
});

test('a failed cross-filter scoping save leaves the revision untouched', async () => {
  jest
    .spyOn(SupersetClient, 'request')
    .mockRejectedValue(new Error('save failed'));

  const { result } = renderHook(() => useSaveCrossFiltersSetting(), {
    wrapper,
  });
  result.current.mutate(true);

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(useDashboardInfoStore.getState().versionHistoryRevision).toBe(0);
});
