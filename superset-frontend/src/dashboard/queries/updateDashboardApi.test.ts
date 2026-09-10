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
import { QueryClient } from '@tanstack/react-query';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import type { DashboardInfo } from 'src/dashboard/types';
import { dashboardKeys } from './keys';
import {
  applyMetadataSaveResult,
  type UpdateDashboardResponse,
} from './updateDashboardApi';

jest.unmock('zustand');

beforeEach(() => {
  useDashboardInfoStore.setState({
    dashboardInfo: { id: 1, metadata: {} } as DashboardInfo,
  });
});

test('parses json_metadata from the response into the dashboardInfo store', () => {
  const queryClient = new QueryClient();
  applyMetadataSaveResult(queryClient, 1, {
    result: { json_metadata: JSON.stringify({ color_scheme: 'blueToGreen' }) },
  } as UpdateDashboardResponse);

  expect(
    useDashboardInfoStore.getState().dashboardInfo.metadata?.color_scheme,
  ).toBe('blueToGreen');
});

test('leaves metadata untouched when the response carries no json_metadata', () => {
  useDashboardInfoStore.setState({
    dashboardInfo: {
      id: 1,
      metadata: { color_scheme: 'existing' },
    } as DashboardInfo,
  });
  const queryClient = new QueryClient();
  applyMetadataSaveResult(queryClient, 1, {
    result: {},
  } as UpdateDashboardResponse);

  expect(
    useDashboardInfoStore.getState().dashboardInfo.metadata?.color_scheme,
  ).toBe('existing');
});

test('invalidates the dashboard detail query', () => {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  applyMetadataSaveResult(queryClient, 1, {
    result: {},
  } as UpdateDashboardResponse);

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: dashboardKeys.detail(1),
  });
});
