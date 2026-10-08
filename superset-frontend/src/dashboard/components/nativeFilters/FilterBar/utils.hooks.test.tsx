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
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { renderHook } from '@testing-library/react';
import { useSlices } from 'src/dashboard/stores';
import { useChartsVerboseMaps } from './utils';

jest.mock('src/dashboard/stores', () => ({
  useSlices: jest.fn(),
}));

const mockUseSlices = useSlices as jest.Mock;

function wrapperWith(datasources: Record<string, unknown>) {
  const store = configureStore({
    reducer: { datasources: (s = datasources) => s },
  });
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

test('maps each chart id to its datasource verbose_map', () => {
  mockUseSlices.mockReturnValue({
    1: { form_data: { datasource: 'ds1' } },
    2: { form_data: { datasource: 'ds2' } },
  });
  const wrapper = wrapperWith({
    ds1: { verbose_map: { col_a: 'Column A' } },
    ds2: { verbose_map: { col_b: 'Column B' } },
  });

  const { result } = renderHook(() => useChartsVerboseMaps(), { wrapper });

  expect(result.current).toEqual({
    1: { col_a: 'Column A' },
    2: { col_b: 'Column B' },
  });
});

test('falls back to an empty map when the chart has no datasource', () => {
  mockUseSlices.mockReturnValue({
    1: { form_data: {} },
  });
  const wrapper = wrapperWith({});

  const { result } = renderHook(() => useChartsVerboseMaps(), { wrapper });

  expect(result.current).toEqual({ 1: {} });
});

test('returns an empty object when there are no slices', () => {
  mockUseSlices.mockReturnValue({});
  const wrapper = wrapperWith({ ds1: { verbose_map: { col_a: 'Column A' } } });

  const { result } = renderHook(() => useChartsVerboseMaps(), { wrapper });

  expect(result.current).toEqual({});
});
