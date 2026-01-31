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
import { renderHook, act } from '@testing-library/react-hooks';
import { ReactNode } from 'react';
import {
  AutoRefreshProvider,
  useAutoRefreshContext,
  useIsAutoRefreshing,
  useIsRefreshInFlight,
} from './AutoRefreshContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AutoRefreshProvider>{children}</AutoRefreshProvider>
);

test('provides default value of false when not inside provider', () => {
  const { result } = renderHook(() => useIsAutoRefreshing());
  expect(result.current).toBe(false);
});

test('provides default refresh in-flight value of false when not inside provider', () => {
  const { result } = renderHook(() => useIsRefreshInFlight());
  expect(result.current).toBe(false);
});

test('isAutoRefreshing starts as false inside provider', () => {
  const { result } = renderHook(() => useAutoRefreshContext(), { wrapper });
  expect(result.current.isAutoRefreshing).toBe(false);
});

test('isRefreshInFlight starts as false inside provider', () => {
  const { result } = renderHook(() => useAutoRefreshContext(), { wrapper });
  expect(result.current.isRefreshInFlight).toBe(false);
});

test('startAutoRefresh sets isAutoRefreshing to true', () => {
  const { result } = renderHook(() => useAutoRefreshContext(), { wrapper });

  act(() => {
    result.current.startAutoRefresh();
  });

  expect(result.current.isAutoRefreshing).toBe(true);
});

test('endAutoRefresh sets isAutoRefreshing to false', () => {
  const { result } = renderHook(() => useAutoRefreshContext(), { wrapper });

  act(() => {
    result.current.startAutoRefresh();
  });
  expect(result.current.isAutoRefreshing).toBe(true);

  act(() => {
    result.current.endAutoRefresh();
  });
  expect(result.current.isAutoRefreshing).toBe(false);
});

test('setIsAutoRefreshing sets the value directly', () => {
  const { result } = renderHook(() => useAutoRefreshContext(), { wrapper });

  act(() => {
    result.current.setIsAutoRefreshing(true);
  });
  expect(result.current.isAutoRefreshing).toBe(true);

  act(() => {
    result.current.setIsAutoRefreshing(false);
  });
  expect(result.current.isAutoRefreshing).toBe(false);
});

test('setRefreshInFlight sets the value directly', () => {
  const { result } = renderHook(() => useAutoRefreshContext(), { wrapper });

  act(() => {
    result.current.setRefreshInFlight(true);
  });
  expect(result.current.isRefreshInFlight).toBe(true);

  act(() => {
    result.current.setRefreshInFlight(false);
  });
  expect(result.current.isRefreshInFlight).toBe(false);
});

test('useIsAutoRefreshing hook returns correct value inside provider', () => {
  const { result } = renderHook(
    () => ({
      context: useAutoRefreshContext(),
      isAutoRefreshing: useIsAutoRefreshing(),
    }),
    { wrapper },
  );

  expect(result.current.isAutoRefreshing).toBe(false);

  act(() => {
    result.current.context.startAutoRefresh();
  });
  expect(result.current.isAutoRefreshing).toBe(true);
});

test('useIsRefreshInFlight hook returns correct value inside provider', () => {
  const { result } = renderHook(
    () => ({
      context: useAutoRefreshContext(),
      isRefreshInFlight: useIsRefreshInFlight(),
    }),
    { wrapper },
  );

  expect(result.current.isRefreshInFlight).toBe(false);

  act(() => {
    result.current.context.setRefreshInFlight(true);
  });

  expect(result.current.isRefreshInFlight).toBe(true);
});
